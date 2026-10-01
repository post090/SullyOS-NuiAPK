// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import BeautyPresetPreview from '../components/share/BeautyPresetPreview';

const renderer=vi.hoisted(()=>vi.fn((_data:unknown,..._options:unknown[])=>({markup:'<main class="sully-chat-root">preview</main>',css:'.sully-chat-root{color:red}'})));
vi.mock('../components/chat/ChatDecorationSample',()=>({renderChatDecorationSample:renderer}));
vi.mock('../components/share/DesktopDecorationSample',()=>({renderDesktopDecorationSample:async()=>({markup:'<main>desktop preview ready</main>',css:'main{color:blue}'})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

it('skips hidden thumbnails, reuses unchanged previews, and renders the latest visible data',async()=>{
 const callbacks:((items:any[])=>void)[]=[];
 const frames:FrameRequestCallback[]=[];
 vi.stubGlobal('IntersectionObserver',class {constructor(callback:any){callbacks.push(callback);}observe(){}disconnect(){}});
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.push(callback);return frames.length;});
 const host=document.createElement('div');const root=createRoot(host);
 const data={format:'sullyos-chat-decoration',version:1,name:'a',parts:{css:'.sully-chat-root{color:red}'}};
 const render=async(value:unknown)=>act(async()=>root.render(React.createElement(BeautyPresetPreview,{data:value,compact:true})));
 try{
  await render(data);expect(renderer).not.toHaveBeenCalled();expect(frames).toHaveLength(0);
  await act(async()=>callbacks[0]([{isIntersecting:true}]));
  expect(renderer).not.toHaveBeenCalled();
  await act(async()=>{await frames.shift()!(0);});expect(renderer).toHaveBeenCalledTimes(1);
  for(let i=0;i<20;i++)await render(data);
  expect(renderer).toHaveBeenCalledTimes(1);
  await act(async()=>callbacks[0]([{isIntersecting:false}]));
  const changed={...data,parts:{css:'.sully-chat-root{color:blue}'}};
  await render(changed);expect(renderer).toHaveBeenCalledTimes(1);
  await act(async()=>callbacks[0]([{isIntersecting:true}]));
  await act(async()=>{await frames.shift()!(16);});
  expect(renderer).toHaveBeenCalledTimes(2);expect(renderer.mock.calls[1][0]).toEqual(changed);
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});

it('awaits desktop preview rendering before parsing its markup',async()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 const host=document.createElement('div');const root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(BeautyPresetPreview,{data:{name:'desktop'}})));
  const shadow=Array.from(host.querySelectorAll('*')).find(element=>element.shadowRoot)?.shadowRoot;
  expect(shadow?.textContent).toContain('desktop preview ready');
  expect(host.querySelector('[role=alert]')).toBeNull();
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
