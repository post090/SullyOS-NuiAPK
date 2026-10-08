// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {HomeSpeechBubble} from '../apps/room3d/HomeSpeechBubble';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>,host:HTMLDivElement,bubble:any,anchor:any;
const editor={getHomeBubble:()=>bubble,getResidentAnchor:()=>anchor};
beforeEach(()=>{vi.useFakeTimers();host=document.createElement('div');document.body.append(host);root=createRoot(host);anchor={x:190,y:330,width:390,height:844};bubble={id:'char',text:'你好。',kind:'speech',at:Date.now()};});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();});
function render(){act(()=>root.render(React.createElement(HomeSpeechBubble,{editor:editor as any})));}
it('places speech above the head and dismisses after reading time',()=>{render();const el=host.querySelector('.home-speech-bubble') as HTMLElement;expect(el.textContent).toBe('你好。');expect(el.style.top).toBe('285px');act(()=>vi.advanceTimersByTime(6600));expect(host.textContent).toBe('');});
it('pages long speech without dropping the ending',()=>{bubble.text='一'.repeat(50)+'。最后一句。';render();expect(host.textContent).toBe('一'.repeat(50)+'。');act(()=>vi.advanceTimersByTime(8200));expect(host.querySelector('.home-speech-retiring')).toBeTruthy();expect(host.textContent).toContain('最后一句。');act(()=>vi.advanceTimersByTime(1900));expect(host.textContent).toBe('最后一句。');});
it('hides bubbles for invisible residents, changed rooms and offscreen anchors',()=>{render();anchor=null;act(()=>vi.advanceTimersByTime(100));expect(host.textContent).toBe('');anchor={x:-10,y:300,width:390,height:844};act(()=>vi.advanceTimersByTime(100));expect(host.textContent).toBe('');bubble=null;act(()=>vi.advanceTimersByTime(100));expect(host.textContent).toBe('');});
