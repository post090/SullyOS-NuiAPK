// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BeautyWardrobe, { type WardrobeEntry } from '../components/appearance/BeautyWardrobe';

const origins=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('./db',()=>({DB:{getAsset:vi.fn(async(key:string)=>origins.has(key)?JSON.stringify(origins.get(key)):null)}}));
vi.mock('../components/share/BeautyPresetPreview', () => ({ default: () => React.createElement('div', null, 'preview') }));
vi.mock('../components/share/BeautyRepoInvitation', () => ({ BeautyRepoBadge: () => null }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

it('keeps deletion available for unreadable presets and provenance without unlocking editing or sharing',async()=>{
 vi.stubGlobal('IntersectionObserver',class {constructor(private callback:any){}observe(){this.callback([{isIntersecting:true}]);}disconnect(){}});
 const host=document.createElement('div');const root=createRoot(host);const remove=vi.fn();
 const entries:WardrobeEntry[]=[
  {id:'broken',name:'缺少素材',read:async()=>{throw Error('部分素材已丢失');},attributionKey:async()=>'broken'},
  {id:'origin-error',name:'来源损坏',read:async()=>({}),attributionKey:async()=>{throw Error('来源读取失败');}},
 ];
 try{
  await act(async()=>root.render(React.createElement(BeautyWardrobe,{entries,onApply:vi.fn(),onEdit:vi.fn(),onShare:vi.fn(),onDelete:remove})));
  expect(host.textContent).not.toContain('正在读取来源');
  expect(host.textContent).toContain('部分素材已丢失');
  expect(host.textContent).toContain('来源读取失败');
  for(const entry of entries){
   const buttons=Array.from(host.querySelector(`[aria-label="${entry.name}的操作"]`)!.querySelectorAll('button'));
   expect(buttons.map(b=>b.textContent)).toEqual(['删除']);
   await act(async()=>buttons[0].click());expect(remove).toHaveBeenCalledWith(entry);
  }
 }finally{await act(async()=>root.unmount());vi.stubGlobal('IntersectionObserver',class {observe(){}disconnect(){}});}
});

it('paginates only local entries, clamps a shortened list, and does not eagerly read offscreen packages', async () => {
  const host = document.createElement('div'); const root = createRoot(host);
  const read = vi.fn(async () => ({}));
  const entries: WardrobeEntry[] = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Preset ${i + 1}`, read, attributionKey: async () => String(i) }));
  const render = async (items: WardrobeEntry[]) => act(async () => root.render(React.createElement(BeautyWardrobe, { entries: items, onApply: vi.fn() })));
  const next = async () => act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === '下一页')!.click(); });
  try {
    await render(entries);
    expect(host.querySelectorAll('.wardrobe-tile')).toHaveLength(12);
    expect(read).not.toHaveBeenCalled();
    await next();
    expect(host.querySelector('.wardrobe-tile')?.getAttribute('aria-label')).toBe('预览 Preset 13');
    await next();
    expect(host.querySelectorAll('.wardrobe-tile')).toHaveLength(1);
    expect(host.querySelector('.wardrobe-tile')?.getAttribute('aria-label')).toBe('预览 Preset 25');
    await render(entries.slice(0, 13));
    expect(host.querySelector('.wardrobe-pagination')?.textContent).toContain('2 / 2');
    expect(host.querySelector('.wardrobe-tile')?.getAttribute('aria-label')).toBe('预览 Preset 13');
  } finally { await act(async () => root.unmount()); }
});

it('offers updates only for code originals, sharing only for self, and locks forbidden edits',async()=>{
 vi.stubGlobal('IntersectionObserver',class {callback:any;constructor(callback:any){this.callback=callback;}observe(){this.callback([{isIntersecting:true}]);}disconnect(){}});
 const share={code:'S-AAAAAAAAAAAA',metadata:{allowRemix:false,credit:'作者'}};
 origins.set('decoration_origin_self',{kind:'self'});origins.set('beauty_source_code',share);origins.set('decoration_origin_file',{kind:'imported',allowRemix:true});origins.set('decoration_origin_remix',{kind:'remix',allowRemix:true});
 const host=document.createElement('div');const root=createRoot(host);const edit=vi.fn(),remove=vi.fn(),shareClick=vi.fn(),update=vi.fn();
 const entries=['self','code','file','remix'].map(id=>({id,name:id,kind:'chat-decoration' as const,read:async()=>({}),attributionKey:async()=>id}));
 try{
  await act(async()=>root.render(React.createElement(BeautyWardrobe,{entries,onApply:vi.fn(),onEdit:edit,onDelete:remove,onShare:shareClick,onUpdate:update})));
  const actions=(id:string)=>host.querySelector(`[aria-label="${id}的操作"]`)!;
  const buttons=(id:string)=>Array.from(actions(id).querySelectorAll('button'));
  expect(buttons('self').map(b=>b.textContent)).toEqual(['编辑','分享','删除']);
  expect(buttons('code').map(b=>b.textContent)).toEqual(['检查更新','编辑','删除']);expect(buttons('code')[1].disabled).toBe(true);
  expect(buttons('file').map(b=>b.textContent)).toEqual(['编辑','删除']);expect(buttons('remix').map(b=>b.textContent)).toEqual(['编辑','删除']);
  await act(async()=>buttons('code')[0].click());expect(update).toHaveBeenCalledWith(entries[1]);
  await act(async()=>buttons('self')[1].click());expect(shareClick).toHaveBeenCalledWith(entries[0]);
 }finally{origins.clear();await act(async()=>root.unmount());}
});
