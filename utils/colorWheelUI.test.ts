// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {ColorWheel} from '../experiments/chibi/ColorWheel';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.append(host);let root:ReturnType<typeof createRoot>;
afterEach(()=>{act(()=>root.unmount());vi.restoreAllMocks();});
function setup(){
 const change=vi.fn(),begin=vi.fn(),end=vi.fn();root=createRoot(host);
 act(()=>root.render(React.createElement(ColorWheel,{label:'肤色',value:'#00ffff',onChange:change,onBegin:begin,onEnd:end})));
 const disk=host.querySelector<HTMLDivElement>('[role=slider]')!;
 disk.setPointerCapture=vi.fn();disk.releasePointerCapture=vi.fn();
 vi.spyOn(disk,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:200,height:200} as DOMRect);
 return {disk,change,begin,end};
}
function pointer(disk:Element,type:string,x:number,y:number){act(()=>{const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(event,'pointerId',{value:1});disk.dispatchEvent(event);});}
it('updates the local swatch while dragging and commits only the final color',()=>{
 const {disk,change,begin,end}=setup();pointer(disk,'pointerdown',100,200);pointer(disk,'pointermove',200,100);
 expect(change).not.toHaveBeenCalled();expect(host.querySelector('output')?.textContent).toBe('#FF0000');
 pointer(disk,'pointerup',200,100);expect(change).toHaveBeenCalledTimes(1);expect(change).toHaveBeenCalledWith('#ff0000');expect(begin).toHaveBeenCalledTimes(1);expect(end).toHaveBeenCalledTimes(1);
});
it('cancels an interrupted gesture and ends adjustment without overwriting color',()=>{
 const {disk,change,end}=setup();pointer(disk,'pointerdown',200,100);pointer(disk,'pointercancel',200,100);
 expect(change).not.toHaveBeenCalled();expect(end).toHaveBeenCalledTimes(1);expect(host.querySelector('output')?.textContent).toBe('#00FFFF');
});
it('supports keyboard hue and saturation selection',()=>{
 const {disk,change}=setup();act(()=>disk.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})));expect(change).toHaveBeenLastCalledWith('#ffffff');
});
