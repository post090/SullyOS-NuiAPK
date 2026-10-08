// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {HairEditor} from '../experiments/chibi/HairEditor';
vi.mock('../experiments/chibi/Puppet', () => ({Puppet: (props:any) => React.createElement('canvas',{'data-motion':props.wardrobeStyle})}));
vi.mock('../experiments/chibi/BodyControls', () => ({BodyControls: () => null}));
vi.mock('../experiments/chibi/FaceTuning', () => ({FaceTuning: () => null}));
vi.mock('../experiments/chibi/FaceControls', () => ({FaceControls: () => null}));
vi.mock('../experiments/chibi/WardrobePicker', () => ({WardrobePicker: () => null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div'); document.body.appendChild(host);
let root: ReturnType<typeof createRoot>;
afterEach(() => {act(() => root.unmount());});
function render() {
 root=createRoot(host);
 const hair={layers:{},extras:[]};
 act(()=>root.render(React.createElement(HairEditor,{hair,previewHair:hair,parts:{} as any,assets:{},onChange:vi.fn(),onUndo:vi.fn(),onRedo:vi.fn(),onReset:vi.fn(),onBegin:vi.fn(),onEnd:vi.fn(),canUndo:false,canRedo:false})));
 (host.querySelector('.hair-preview') as any).setPointerCapture=vi.fn();
}
function pointer(target:Element,type:string,x:number,primary=true,id=1) {
 const event=new MouseEvent(type,{bubbles:true,clientX:x,button:0});
 Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:primary},pointerType:{value:'touch'}});
 act(()=>target.dispatchEvent(event));
}
const angle=()=>Number(host.querySelector<HTMLElement>('.hair-preview')!.dataset.yaw);
it('rotates with one touch, wraps the angle and stops on cancellation',()=>{
 render();const canvas=host.querySelector('canvas')!;
 pointer(canvas,'pointerdown',100);pointer(canvas,'pointermove',200);expect(angle()).toBe(68);
 pointer(canvas,'pointermove',700);expect(angle()).toBe(8);
 pointer(canvas,'pointercancel',700);pointer(canvas,'pointermove',800);expect(angle()).toBe(8);
});
it('does not rotate from toolbar or inspector gestures, and uses two fingers for pan and zoom',()=>{
 render();const button=host.querySelector('.preview-tools button')!;
 pointer(button,'pointerdown',100);pointer(button,'pointermove',200);expect(angle()).toBe(8);
 const options=host.querySelector('.hair-options')!;
 pointer(options,'pointerdown',100);pointer(options,'pointermove',200);expect(angle()).toBe(8);
 const canvas=host.querySelector('canvas')!;
 pointer(canvas,'pointerdown',100);pointer(canvas,'pointerdown',120,false,2);pointer(canvas,'pointermove',200);expect(angle()).toBe(8);
});

it('zooms and pans with two touches, then resets the view',()=>{
 render();const canvas=host.querySelector('canvas')!;
 pointer(canvas,'pointerdown',100);pointer(canvas,'pointerdown',200,false,2);
 pointer(canvas,'pointermove',300,false,2);
 const preview=host.querySelector<HTMLElement>('.hair-preview')!;
 expect(Number(preview.dataset.zoom)).toBe(2);expect(angle()).toBe(8);
 expect(preview.dataset.pan).toBe('50,0');
 act(()=>host.querySelector<HTMLButtonElement>('[aria-label="回到正面"]')!.click());
 expect(Number(preview.dataset.zoom)).toBe(1);expect(preview.dataset.pan).toBe('0,0');
 expect(host.querySelector('[aria-label="3D 预览转角"]')).toBeNull();
});

it('uses motion 12 and keeps history visible without an audition menu',()=>{
 render();expect(host.querySelector('canvas')!.dataset.motion).toBe('mmd-breath');expect(host.querySelector('[aria-label="试衣站姿"]')).toBeNull();expect(host.querySelector('[aria-label="编辑历史"] [aria-label="撤回"]')).not.toBeNull();expect(host.querySelector('[aria-label="编辑历史"] [aria-label="重做"]')).not.toBeNull();
});
