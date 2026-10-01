// @vitest-environment jsdom
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {Simulate} from 'react-dom/test-utils';import {it,expect,vi} from 'vitest';
import OutfitCollection from '../components/chat/OutfitCollection';
vi.mock('../components/chat/DecorationPresetThumb',()=>({default:({entry,onChoose}:any)=>React.createElement('button',{onClick:onChoose},entry.name)}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
it('paginates, searches, clamps after deleting the last page, and previews without applying',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const choose=vi.fn(),remove=vi.fn();
 let entries=Array.from({length:13},(_,i)=>({id:`outfit-${i}`,name:`搭配 ${i+1}`} as any));
 const render=()=>act(async()=>root.render(React.createElement(OutfitCollection,{entries,busy:false,error:'',onClose:vi.fn(),onChoose:choose,onDelete:remove,onSave:vi.fn()})));
 const click=(text:string)=>act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===text)!.click());
 try{
  await render();expect(host.querySelectorAll('article')).toHaveLength(6);await click('下一页');await click('下一页');expect(host.querySelectorAll('article')).toHaveLength(1);
  await click('搭配 13');expect(choose).toHaveBeenCalledWith(entries[12]);await click('删除');expect(remove).toHaveBeenCalledWith(entries[12]);
  entries=entries.slice(0,12);await render();expect((host.querySelector('select') as HTMLSelectElement).value).toBe('1');expect(host.querySelectorAll('article')).toHaveLength(6);
  await act(async()=>Simulate.change(host.querySelector('input')!,{target:{value:'搭配 2'}} as any));expect(host.querySelectorAll('article')).toHaveLength(1);expect((host.querySelector('select') as HTMLSelectElement).value).toBe('0');
  await act(async()=>Simulate.change(host.querySelector('input')!,{target:{value:'不存在'}} as any));expect(host.textContent).toContain('没有找到');
  await act(async()=>Simulate.change(host.querySelector('input')!,{target:{value:''}} as any));expect(host.querySelectorAll('article')).toHaveLength(6);
 }finally{await act(async()=>root.unmount());host.remove();}
});
