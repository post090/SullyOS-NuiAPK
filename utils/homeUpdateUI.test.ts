// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import HomeUpdatePopup from '../components/os/HomeUpdatePopup';
import {HOME_UPDATE_KEY,HOME_UPDATE_PAGES} from './homeUpdate';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.append(host);let root:ReturnType<typeof createRoot>;
beforeEach(()=>{localStorage.removeItem(HOME_UPDATE_KEY);HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>act(()=>root.unmount()));
function setup(){const done=vi.fn(),visit=vi.fn(),guide=vi.fn();root=createRoot(host);act(()=>root.render(React.createElement(HomeUpdatePopup,{onDone:done,onVisit:visit,onGuide:guide})));return {done,visit,guide};}
function click(name:string){const button=Array.from(host.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||b.textContent?.trim())===name)!;expect(button).toBeTruthy();act(()=>button.click());}
it('page navigation and screenshot zoom do not mark the announcement as read',()=>{
 setup();click('下一页');expect(host.querySelector('h2')?.textContent).toBe(HOME_UPDATE_PAGES[1].title);click('放大截图：当面聊天');expect(host.querySelectorAll('dialog[open]')).toHaveLength(2);
 act(()=>host.querySelector('.home-release-zoom')!.dispatchEvent(new Event('cancel',{bubbles:true,cancelable:true})));expect(host.querySelectorAll('dialog[open]')).toHaveLength(1);expect(localStorage.getItem(HOME_UPDATE_KEY)).toBeNull();
});
it('marks read on an explicit close and only exits once',()=>{
 const {done}=setup();click('关闭家园更新介绍');expect(localStorage.getItem(HOME_UPDATE_KEY)).toBe('1');expect(done).toHaveBeenCalledOnce();
});
it('visits the home after the last page and offers the full guide separately',()=>{
 const {visit,guide}=setup();for(let i=1;i<HOME_UPDATE_PAGES.length;i++)click('下一页');click('去 3D 家园看看');expect(visit).toHaveBeenCalledOnce();expect(localStorage.getItem(HOME_UPDATE_KEY)).toBe('1');expect(guide).not.toHaveBeenCalled();
});
