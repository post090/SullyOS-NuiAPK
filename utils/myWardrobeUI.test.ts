// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {MyWardrobe} from '../experiments/chibi/MyWardrobe';
import {DB} from './db';
import {makeOutfit} from '../apps/room3d/chibi/outfitLibrary';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.appendChild(host);let root:ReturnType<typeof createRoot>;
afterEach(()=>{act(()=>root?.unmount());vi.restoreAllMocks();});
it('saves, reopens and wears a personal outfit without changing the face',async()=>{
 const hair={layers:{},extras:[],face:{enabled:true},wardrobe:{ears:'cat-ears',tail:'cat-tail'}};let rows:any[]=[];
 vi.spyOn(DB,'getUserProfile').mockImplementation(async()=>({name:'QA',avatar:'',bio:'',wardrobeOutfits:rows}));
 vi.spyOn(DB,'updateWardrobeOutfits').mockImplementation(async update=>rows=update(rows));const change=vi.fn();
 root=createRoot(host);await act(async()=>root.render(React.createElement(MyWardrobe,{hair,onChange:change})));
 const button=(label:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;
 act(()=>button('保存当前搭配').click());
 const input=host.querySelector<HTMLInputElement>('[aria-label="搭配名称"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'猫猫');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(rows[0].name).toBe('猫猫');expect(rows[0].clothes.wardrobe).toEqual(hair.wardrobe);
 act(()=>root.unmount());root=createRoot(host);await act(async()=>root.render(React.createElement(MyWardrobe,{hair,onChange:change})));
 act(()=>button('穿上猫猫').click());expect(change.mock.lastCall?.[0].face).toBe(hair.face);
 expect(button('导出猫猫')).toBeTruthy();expect(button('重命名猫猫')).toBeTruthy();
 act(()=>button('删除猫猫').click());expect(rows).toHaveLength(1);
 await act(async()=>button('删除').click());expect(rows).toHaveLength(0);
});
it('reports storage failure and leaves the saved library intact',async()=>{
 const hair={layers:{},extras:[]},row=makeOutfit('保留',hair);
 vi.spyOn(DB,'getUserProfile').mockResolvedValue({name:'QA',avatar:'',bio:'',wardrobeOutfits:[row]});
 vi.spyOn(DB,'updateWardrobeOutfits').mockRejectedValue(new Error('空间不足'));
 root=createRoot(host);await act(async()=>root.render(React.createElement(MyWardrobe,{hair,onChange:vi.fn()})));
 act(()=>host.querySelector<HTMLButtonElement>('[aria-label="删除保留"]')!.click());
 await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='删除')!.click());
 expect(host.querySelector('[role="status"]')?.textContent).toBe('空间不足');expect(host.querySelector('[aria-label="穿上保留"]')).not.toBeNull();
});
