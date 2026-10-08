// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import HomeQualityTip from '../apps/room3d/HomeQualityTip';

let root:Root,host:HTMLDivElement;
const openPanel=vi.fn(),editor={openPanel} as any;
beforeEach(()=>{
 localStorage.clear();openPanel.mockClear();host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const render=(active=true)=>act(()=>root.render(React.createElement(HomeQualityTip,{editor,active})));
it('opens only while the home is active and remembers acknowledgment on this device',()=>{
 render(false);expect(host.querySelector('dialog')?.open).toBe(false);render();expect(host.querySelector('dialog')?.open).toBe(true);
 act(()=>host.querySelector<HTMLButtonElement>('button')!.click());expect(host.querySelector('dialog')?.open).toBe(false);
 act(()=>root.unmount());root=createRoot(host);render();expect(host.querySelector('dialog')?.open).toBe(false);expect(openPanel).not.toHaveBeenCalled();
});
it('opens the existing quality panel without changing the selected quality',()=>{
 render();act(()=>host.querySelectorAll<HTMLButtonElement>('button')[1].click());expect(openPanel).toHaveBeenCalledWith('quality');expect(host.querySelector('dialog')?.open).toBe(false);
});
