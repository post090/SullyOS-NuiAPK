// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {FigureSlider} from '../experiments/chibi/FigureSlider';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.appendChild(host);
let root:ReturnType<typeof createRoot>;
afterEach(()=>act(()=>root.unmount()));
function setup(){
 const change=vi.fn(),end=vi.fn();root=createRoot(host);
 const render=(value=0)=>act(()=>root.render(React.createElement(FigureSlider,{label:'位置',value,min:-1.5,max:1.5,step:.01,onChange:change,onEnd:end})));
 render();return {change,end,render,input:host.querySelector<HTMLInputElement>('input[type=number]')!};
}
function enter(input:HTMLInputElement,text:string){act(()=>input.focus());act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('keeps typing local, then clamps and rounds once on commit',()=>{
 const {input,change}=setup();enter(input,'-0.376');expect(change).not.toHaveBeenCalled();act(()=>input.blur());expect(change).toHaveBeenLastCalledWith(-.38);
 enter(input,'80');act(()=>input.blur());expect(change).toHaveBeenLastCalledWith(1.5);
});
it('preserves the value on empty input, cancellation and unchanged commit',()=>{
 const {input,change,end}=setup();enter(input,'');act(()=>input.blur());expect(input.value).toBe('0.00');
 enter(input,'1');act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(input.value).toBe('0.00');expect(change).not.toHaveBeenCalled();expect(end).toHaveBeenCalled();
});
it('commits Enter and synchronizes external undo values',()=>{
 const {input,change,render}=setup();enter(input,'.25');act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 expect(change).toHaveBeenCalledWith(.25);render(-.5);expect(input.value).toBe('-0.50');
 expect(host.querySelector<HTMLInputElement>('input[type=range]')!.value).toBe('-0.5');
});
