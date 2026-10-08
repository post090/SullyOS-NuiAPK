// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {AppearanceColorControl} from '../experiments/chibi/AppearanceColorControl';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.appendChild(host);
let root:ReturnType<typeof createRoot>;
afterEach(()=>act(()=>root.unmount()));
function setup(){
 const change=vi.fn();root=createRoot(host);
 const render=(value?:string)=>act(()=>root.render(React.createElement(AppearanceColorControl,{label:'肤色',value,colors:['#f0d3bb'],onChange:change,onBegin:()=>{},onEnd:()=>{}})));
 render();return {change,render,input:host.querySelector<HTMLInputElement>('input:not([type=color])')!};
}
function type(input:HTMLInputElement,value:string){act(()=>input.focus());act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('does not replace original skin on focus/blur, invalid input or Escape',()=>{
 const {input,change}=setup();type(input,'#f0d3bb');act(()=>input.blur());
 type(input,'no');act(()=>input.blur());expect(input.value).toBe('#f0d3bb');
 type(input,'#112233');act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));act(()=>input.blur());
 expect(change).not.toHaveBeenCalled();
});
it('commits a valid HEX once on Enter and follows undo',()=>{
 const {input,change,render}=setup();type(input,'BB8866');expect(change).not.toHaveBeenCalled();
 act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(change).toHaveBeenCalledTimes(1);expect(change).toHaveBeenLastCalledWith('#bb8866');
 render('#ffddaa');expect(input.value).toBe('#ffddaa');
});
