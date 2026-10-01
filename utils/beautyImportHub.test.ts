// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import {it,expect,vi} from 'vitest';
import BeautyImportHub from '../components/share/BeautyImportHub';
vi.mock('../components/share/BeautyPresetPreview',()=>({default:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('requires source choice for legacy CSS and separates album from file input',async()=>{
 const host=document.createElement('div');const root=createRoot(host);const onCss=vi.fn(async()=>{});const click=async(label:string)=>act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label)!.click();});
 try{await act(async()=>root.render(React.createElement(BeautyImportHub,{codePanel:React.createElement('p',null,'领取'),busy:false,onFile:()=>{},onCss})));
 await click('文件 / 图片');expect(host.querySelector('input[aria-label="装扮文件"]')?.getAttribute('accept')).toBe('*/*');expect(host.querySelector('input[aria-label="装扮相册图片"]')?.getAttribute('accept')).toBe('image/*');
 await click('直接 CSS');await act(async()=>Simulate.change(host.querySelector('textarea')!,{target:{value:'.sully-chat-root {color:red}'}} as any));await click('保存到装扮库');expect(onCss).not.toHaveBeenCalled();expect(host.textContent).toContain('请选择这份 CSS 是自制还是外部导入');
 await act(async()=>Simulate.change(host.querySelectorAll('input[type=radio]')[1],{target:{checked:true}} as any));await click('保存到装扮库');expect(onCss).toHaveBeenCalledWith(expect.objectContaining({name:'导入的白框'}),expect.objectContaining({kind:'imported'}));
 }finally{await act(async()=>root.unmount());}
});

it('requires source confirmation for old batches and submits all presets together',async()=>{
 const host=document.createElement('div');const root=createRoot(host);const batch=vi.fn(async()=>{});const single=vi.fn(async()=>{});
 const text=JSON.stringify([{name:'甲',code:'.sully-chat-root {color:red}'},{name:'乙',code:'.sully-chat-root {color:blue}'}]);
 const click=()=>act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='保存到装扮库')!.click());
 try{await act(async()=>root.render(React.createElement(BeautyImportHub,{codePanel:null,busy:false,onFile:()=>{},onCss:single,onCssBatch:batch,initialCss:{text,name:'合集'}})));
 await click();expect(batch).not.toHaveBeenCalled();await act(async()=>Simulate.change(host.querySelectorAll('input[type=radio]')[1],{target:{checked:true}} as any));await click();
 expect(single).not.toHaveBeenCalled();expect(batch).toHaveBeenCalledWith([expect.objectContaining({preset:expect.objectContaining({name:'甲'}),origin:expect.objectContaining({kind:'imported'})}),expect.objectContaining({preset:expect.objectContaining({name:'乙'})})]);
 }finally{await act(async()=>root.unmount());}
});
