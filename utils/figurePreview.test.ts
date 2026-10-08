// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useFigurePreview} from '../experiments/chibi/useFigurePreview';
import {defaultHairLayer,type HairSettings} from '../apps/room3d/chibi/types';
import {cleanFace} from '../apps/room3d/chibi/faceAppearance';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.appendChild(host);
let root:ReturnType<typeof createRoot>,current:ReturnType<typeof useFigurePreview>;
function Harness({value,active}:{value:HairSettings;active:boolean}){current=useFigurePreview(value,active);return null;}
function render(value:HairSettings,active:boolean){act(()=>root.render(React.createElement(Harness,{value,active})));}
function setup(){vi.useFakeTimers();root=createRoot(host);const initial:HairSettings={layers:{},extras:[]};render(initial,false);return initial;}
afterEach(()=>{act(()=>root.unmount());vi.useRealTimers();});
it('keeps meshes unchanged through a long drag and commits only the final value on release',()=>{
 const initial=setup();let last=initial;
 for(let i=1;i<=25;i++){
  last={...initial,layers:{back1:{...defaultHairLayer,width:1+i/100}}};render(last,true);
  act(()=>vi.advanceTimersByTime(200));expect(current.preview).toBe(initial);expect(current.deferred).toBe(true);
 }
 render(last,false);act(()=>vi.advanceTimersByTime(60));expect(current.preview).toBe(last);expect(current.deferred).toBe(false);
});
it('coalesces face inputs but previews a paused facial adjustment without a mesh change',()=>{
 const initial=setup();let last=initial;
 for(let i=1;i<=12;i++){last={...initial,face:cleanFace({browOffsetY:i})};render(last,true);act(()=>vi.advanceTimersByTime(10));expect(current.preview).toBe(initial);}
 act(()=>vi.advanceTimersByTime(80));expect(current.preview).toBe(last);expect(current.preview.layers).toBe(initial.layers);
});
it('cancels a pending rebuild on a new gesture or unmount',()=>{
 const initial=setup(),next={...initial,headSize:1.2};render(next,false);act(()=>vi.advanceTimersByTime(30));render(next,true);act(()=>vi.advanceTimersByTime(500));expect(current.preview).toBe(initial);
 render(next,false);act(()=>root.unmount());expect(vi.getTimerCount()).toBe(0);
 root=createRoot(host);
});
