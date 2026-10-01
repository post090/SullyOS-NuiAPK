// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import DecorationGuide from '../components/chat/DecorationGuide';
import DecorationUpdatePopup from '../components/chat/DecorationUpdatePopup';
import {DECORATION_UPDATE_KEY,DECORATION_GUIDE_KEY,needsDecorationGuide,finishDecorationGuide} from './decorationGuide';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
HTMLDialogElement.prototype.showModal=function(){this.open=true;};
HTMLDialogElement.prototype.close=function(){this.open=false;};
it('acknowledges the announcement independently of completing the first-use guide',async()=>{
 localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const closed=vi.fn();
 try{
  await act(async()=>root.render(React.createElement(DecorationUpdatePopup,{onClose:closed})));
  expect(localStorage.getItem(DECORATION_UPDATE_KEY)).toBeNull();expect(needsDecorationGuide()).toBe(true);
  await act(async()=>host.querySelector('button')!.click());
  expect(closed).toHaveBeenCalledOnce();expect(localStorage.getItem(DECORATION_UPDATE_KEY)).toBe('1');expect(needsDecorationGuide()).toBe(true);
  finishDecorationGuide();expect(needsDecorationGuide()).toBe(false);expect(localStorage.getItem(DECORATION_GUIDE_KEY)).toBe('1');
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
it('highlights actual controls, waits for clicks, and hides below native dialogs',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const next=vi.fn();const skip=vi.fn();
 const target=document.createElement('button');target.dataset.dressGuide='mine';document.body.append(target);
 const modal=document.createElement('dialog');document.body.append(modal);
 try{
  await act(async()=>root.render(React.createElement(DecorationGuide,{step:1,onNext:next,onSkip:skip})));
  expect(document.querySelector('.dress-guide-focus')).not.toBeNull();expect(document.querySelector('.dress-guide-next')).toBeNull();
  expect(document.querySelector('.dress-guide-note')?.textContent).toContain('点右上角「我的」');
  await act(async()=>modal.showModal());expect(document.querySelector('.dress-guide-layer')).toBeNull();
  await act(async()=>modal.close());expect(document.querySelector('.dress-guide-layer')).not.toBeNull();
  await act(async()=>root.render(React.createElement(DecorationGuide,{step:2,onNext:next,onSkip:skip})));
  await act(async()=>document.querySelector<HTMLButtonElement>('.dress-guide-next')!.click());expect(next).toHaveBeenCalledOnce();
  await act(async()=>document.querySelector<HTMLButtonElement>('.dress-guide-note header button')!.click());expect(skip).toHaveBeenCalledOnce();
 }finally{await act(async()=>root.unmount());host.remove();target.remove();modal.remove();}
});
