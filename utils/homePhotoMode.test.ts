// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import HomePhotoMode from '../apps/room3d/HomePhotoMode';
import {PHOTO_LETTERING_KEY} from '../apps/room3d/photoLettering';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

vi.mock('../apps/room3d/PhotoFilterPresets',()=>({default:()=>null}));
vi.mock('../utils/shareExport',()=>({savePhotoToGallery:vi.fn(),shareOrDownloadBlob:vi.fn()}));
vi.mock('@phosphor-icons/react',()=>({Camera:()=>null,X:()=>null,DownloadSimple:()=>null,ArrowCounterClockwise:()=>null,ShareNetwork:()=>null,SlidersHorizontal:()=>null,Users:()=>null,PersonSimpleRun:()=>null,Sparkle:()=>null,CaretDown:()=>null,CaretLeft:()=>null,Eye:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.append(host);let root:ReturnType<typeof createRoot>;
beforeEach(()=>{
 localStorage.clear();
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(844);
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout);
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=>'blob:photo'),revokeObjectURL:vi.fn()}));
 HTMLElement.prototype.setPointerCapture=vi.fn();
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:vi.fn(),drawImage:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),scale:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),bezierCurveTo:vi.fn(),closePath:vi.fn(),fill:vi.fn(),fillText:vi.fn(),measureText:vi.fn(()=>({width:100}))} as any);
 vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(cb=>cb(new Blob(['png'],{type:'image/png'})));
 root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(actors:Array<{id:string;label:string}>=[]){const editor={beginPhotoMode:vi.fn(()=>actors),endPhotoMode:vi.fn(),setPhotoCamera:vi.fn(),setPhotoTogether:vi.fn(),setPhotoPose:vi.fn(),setPhotoInteraction:vi.fn(),setPhotoFace:vi.fn(),setPhotoTurn:vi.fn(),setPhotoDof:vi.fn(),setPhotoFocusAt:vi.fn((_x:number,_y:number)=>true),setPhotoFocusPart:vi.fn(),setPhotoLighting:vi.fn(),setPhotoLampColor:vi.fn(),getLightingMode:vi.fn(()=>'day'),canPlaySocial:vi.fn(()=>true),renderPhoto:vi.fn(),subscribePhoto:vi.fn(()=>()=>{})};const close=vi.fn();await act(async()=>{root.render(React.createElement(HomePhotoMode,{editor:editor as any,onClose:close}));});await act(async()=>{await new Promise(r=>setTimeout(r,10));});return {editor,close};}
async function click(label:string){const button=[...host.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent===label)!;expect(button).toBeTruthy();await act(async()=>button.click());}
async function previewFrame(){await act(async()=>{await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));});}
it('opens the lens controls in portrait and exports the chosen aspect',async()=>{
 const {editor}=await setup();expect(editor.renderPhoto.mock.calls.at(-1)?.[2]).toMatchObject({aspect:390/844,quality:'preview'});
 expect(host.querySelector<HTMLElement>('.photo-stage')?.style.inset).toBe('0px');
 await click('镜头');await click('竖幅 3:4');expect(editor.renderPhoto.mock.calls.at(-1)?.[2].aspect).toBe(3/4);
 await click('电影 2.39:1');await click('拍下合影');
 const call=editor.renderPhoto.mock.calls.find(c=>c[2]?.quality==='export')!;expect(call[2].aspect).toBe(2.39);expect(call[0]).not.toBe(host.querySelector('.photo-view'));expect(host.querySelector('img[alt="拍好的合影"]')).toBeTruthy();
});
it.each(['奶油拍立得','爱心大头贴','四格贴纸'])('exports %s with the same photo windows as its preview',async label=>{
 const {editor}=await setup();await click('镜头');await click(label);await click('拍下合影');
 const call=editor.renderPhoto.mock.calls.find(c=>c[2]?.quality==='export')!;expect(call[2].aspect).toBe(1);
 expect(host.querySelector('img[alt="拍好的合影"]')).toBeTruthy();
});
it('changes framing without resetting poses and reserves standing reset for its labelled button',async()=>{
 const {editor}=await setup([{id:'a',label:'小白'},{id:'b',label:'小绿'}]);await click('镜头');expect(editor.setPhotoTogether).not.toHaveBeenCalled();
 await click('爱心大头贴');expect(editor.setPhotoTogether).not.toHaveBeenCalled();expect(editor.setPhotoCamera).toHaveBeenLastCalledWith(expect.objectContaining({zoom:1.65,height:1.75}));
 await click('居中同框');expect(editor.setPhotoTogether).not.toHaveBeenCalled();
 await click('全身 9:16');expect(editor.setPhotoTogether).not.toHaveBeenCalled();expect(editor.setPhotoCamera).toHaveBeenLastCalledWith(expect.objectContaining({zoom:1.5,height:1.2}));
 await click('爱心大头贴');await click('双人并排站位会重置当前动作›');expect(editor.setPhotoTogether).toHaveBeenCalledOnce();
});
it('maps sideways drags into camera coordinates and leaves the shared application unrotated',async()=>{
 const {editor}=await setup();await click('横屏');expect(host.querySelector('.home-photo-mode')?.getAttribute('data-sideways')).toBe('true');expect(host.style.transform).toBe('');
 const canvas=host.querySelector('canvas')!;const send=(type:string,x:number,y:number)=>canvas.dispatchEvent(Object.assign(new MouseEvent(type,{bubbles:true,clientX:x,clientY:y}),{pointerId:1}));
 act(()=>{send('pointerdown',50,50);send('pointermove',50,90);send('pointerup',50,90);});
 expect(editor.setPhotoCamera).toHaveBeenLastCalledWith(expect.objectContaining({yaw:-14,pitch:4}));await click('竖屏');expect(host.querySelector('.home-photo-mode')?.getAttribute('data-sideways')).toBe('false');
});
it('fills the screen even while the measured stage still has its old inset dimensions',async()=>{
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(function(this:HTMLElement){return this.classList.contains('photo-stage')?210:390;});
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockImplementation(function(this:HTMLElement){return this.classList.contains('photo-stage')?370:844;});
 const {editor}=await setup(),frame=host.querySelector<HTMLElement>('.photo-frame')!;
 expect(editor.setPhotoCamera).toHaveBeenLastCalledWith(expect.objectContaining({zoom:1.5}));
 expect([frame.style.width,frame.style.height]).toEqual(['390px','844px']);
 await click('横屏');expect([frame.style.width,frame.style.height]).toEqual(['844px','390px']);await previewFrame();
 expect(editor.renderPhoto.mock.calls.at(-1)?.[2].aspect).toBe(844/390);
 await click('拍下合影');expect(editor.renderPhoto.mock.calls.find(c=>c[2]?.quality==='export')?.[2].aspect).toBe(844/390);
});
it('turns the full-body frame into 16:9 in landscape and keeps manual framing and poses while rotating',async()=>{
 const {editor}=await setup([{id:'a',label:'小白'},{id:'b',label:'小绿'}]);
 await click('镜头');await click('全身 9:16');await edit('拉近','2');await click('收起调节');
 const cameraCalls=editor.setPhotoCamera.mock.calls.length;
 await click('横屏');expect(host.querySelector('.photo-format-label')?.textContent).toBe('全身 16:9');await previewFrame();
 expect(editor.renderPhoto.mock.calls.at(-1)?.[2].aspect).toBe(16/9);
 expect(editor.setPhotoCamera).toHaveBeenCalledTimes(cameraCalls);expect(editor.setPhotoTogether).not.toHaveBeenCalled();
 await click('竖屏');expect(host.querySelector('.photo-format-label')?.textContent).toBe('全身 9:16');await previewFrame();
 expect(editor.renderPhoto.mock.calls.at(-1)?.[2].aspect).toBe(9/16);
 expect(editor.setPhotoCamera).toHaveBeenCalledTimes(cameraCalls);
 await click('横屏');await click('拍下合影');
 expect(editor.renderPhoto.mock.calls.find(c=>c[2]?.quality==='export')?.[2].aspect).toBe(16/9);
 expect(host.querySelector('.photo-result-caption strong')?.textContent).toBe('全身 16:9');
});
it('releases the empty landscape panel column and all insets in clean mode using the actual stylesheet',async()=>{
 const style=document.createElement('style');style.textContent=readFileSync(resolve(__dirname,'../apps/room3d/homePhoto.css'),'utf8');document.head.append(style);
 try{
  await setup();await click('镜头');await click('全身 9:16');await click('收起调节');await click('横屏');
  const stage=host.querySelector<HTMLElement>('.photo-stage')!;
  expect(getComputedStyle(stage).right).toBe('12px');
  await click('镜头');expect(getComputedStyle(stage).right).toBe('324px');
  await click('收起调节');expect(getComputedStyle(stage).right).toBe('12px');
  await click('纯净');expect(getComputedStyle(stage).inset).toBe('0px');
 }finally{style.remove();}
});
it('requests real negative space through camera pan and preserves the existing exit path',async()=>{
 const {editor,close}=await setup();await click('镜头');await click('左侧留白');expect(editor.setPhotoCamera).toHaveBeenLastCalledWith(expect.objectContaining({pan:-2,zoom:.78}));expect(host.querySelector('.photo-format-label')?.textContent).toBe('全屏');await click('退出拍照');expect(close).toHaveBeenCalledOnce();
});
async function edit(label:string,value:string){
 const input=host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement|HTMLSelectElement;
 const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,10));});
 await act(async()=>{await new Promise(r=>setTimeout(r,10));});
}
it('uses edited text in preview and export, remembers each paper, and permits a blank footer',async()=>{
 await setup();await click('镜头');await click('奶油拍立得');
 await edit('相纸主文案','和你一起过万圣节 ♡');await edit('相纸底部小字','');await edit('相纸字体','handwritten');
 const context=host.querySelector('canvas')!.getContext('2d')!;
 expect(context.fillText).toHaveBeenCalledWith('和你一起过万圣节 ♡',expect.any(Number),expect.any(Number),expect.any(Number));
 expect(context.font).toContain('KaiTi');
 await click('爱心大头贴');expect((host.querySelector('[aria-label="相纸主文案"]') as HTMLInputElement).value).toBe('you make me smile');
 await click('奶油拍立得');expect((host.querySelector('[aria-label="相纸主文案"]') as HTMLInputElement).value).toBe('和你一起过万圣节 ♡');
 vi.mocked(context.fillText).mockClear();await click('拍下合影');
 expect(context.fillText).toHaveBeenCalledWith('和你一起过万圣节 ♡',1024,2560*.87,2048*.58);
 expect(context.fillText).not.toHaveBeenCalledWith('S U L L Y  ·  H O M E',expect.anything(),expect.anything(),expect.anything());
 expect(JSON.parse(localStorage.getItem(PHOTO_LETTERING_KEY)!)).toMatchObject({polaroid:{title:'和你一起过万圣节 ♡',footer:'',font:'handwritten'}});
 act(()=>root.unmount());root=createRoot(host);await setup();await click('镜头');await click('奶油拍立得');
 expect((host.querySelector('[aria-label="相纸主文案"]') as HTMLInputElement).value).toBe('和你一起过万圣节 ♡');
 await click('恢复这款相纸的文字');expect((host.querySelector('[aria-label="相纸主文案"]') as HTMLInputElement).value).toBe('a little moment');
});
it('freezes the scene before waiting for fonts and keeps later format changes out of the shot',async()=>{
 const {editor}=await setup();await click('镜头');await click('奶油拍立得');
 let loaded!:()=>void;
 const pending=new Promise<void>(resolve=>{loaded=resolve;});
 const original=Object.getOwnPropertyDescriptor(document,'fonts');
 Object.defineProperty(document,'fonts',{configurable:true,value:{load:vi.fn(()=>pending)}});
 try{
  await click('拍下合影');expect(editor.renderPhoto.mock.calls.filter(c=>c[2]?.quality==='export')).toHaveLength(1);
  expect(editor.renderPhoto.mock.calls.find(c=>c[2]?.quality==='export')?.[2].aspect).toBe(1);
  expect((host.querySelector('[aria-label="拍下合影"]') as HTMLButtonElement).disabled).toBe(true);
  await click('电影 2.39:1');expect(host.querySelector('img[alt="拍好的合影"]')).toBeNull();
  await act(async()=>loaded());expect(host.querySelector('.photo-result-caption strong')?.textContent).toBe('奶油拍立得');
  expect(editor.renderPhoto.mock.calls.filter(c=>c[2]?.quality==='export')).toHaveLength(1);
 }finally{if(original)Object.defineProperty(document,'fonts',original);else Reflect.deleteProperty(document,'fonts');}
});

it('keeps the viewfinder mounted while panels open and restores controls from clean mode',async()=>{
 const {close}=await setup();const stage=host.querySelector('.photo-stage');expect(host.querySelector('.photo-controls')).toBeNull();expect(host.querySelectorAll('.photo-drag-switch button')).toHaveLength(2);
 await click('镜头');expect(host.querySelector('.photo-stage')).toBe(stage);expect(host.querySelector('.photo-controls')).toBeTruthy();
 await click('收起调节');expect(host.querySelector('.photo-controls')).toBeNull();await click('纯净');
 expect(host.querySelector('.home-photo-mode')?.getAttribute('data-clean')).toBe('true');expect(host.querySelector<HTMLElement>('.photo-dock')?.hidden).toBe(true);expect(host.querySelector<HTMLElement>('footer')?.hidden).toBe(true);
 await click('显示控制');expect(host.querySelector('.home-photo-mode')?.getAttribute('data-clean')).toBe('false');
 await click('镜头');await act(async()=>host.querySelector<HTMLButtonElement>('.photo-advanced-entry')!.click());
 const roll=host.querySelector<HTMLInputElement>('[aria-label="镜头倾斜"]')!;expect(roll.min).toBe('-180');expect(roll.max).toBe('180');
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});expect(host.querySelector('.photo-advanced-entry')).toBeTruthy();expect(close).not.toHaveBeenCalled();
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});expect(host.querySelector('.photo-controls')).toBeNull();expect(close).not.toHaveBeenCalled();
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});expect(close).toHaveBeenCalledOnce();
});
it('returns from a landscape result to the camera and revokes its blob URL',async()=>{
 const {close}=await setup();await click('镜头');await click('横幅 16:9');await click('拍下合影');
 expect(host.querySelector('.photo-result')?.getAttribute('data-orientation')).toBe('landscape');expect(URL.revokeObjectURL).not.toHaveBeenCalled();
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});
 expect(host.querySelector('.photo-result')).toBeNull();expect(host.querySelector('.photo-stage')?.getAttribute('aria-hidden')).toBe('false');expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');expect(close).not.toHaveBeenCalled();
});
it('maps a rotated free-focus pointer through the contained canvas',async()=>{
 const {editor}=await setup();await click('镜头');await act(async()=>host.querySelector<HTMLButtonElement>('.photo-advanced-entry')!.click());await click('景深：关');await click('横屏');
 const canvas=host.querySelector('canvas')!;canvas.width=canvas.height=800;vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:10,top:20,width:300,height:400,right:310,bottom:420,x:10,y:20,toJSON:()=>({})} as DOMRect);
 editor.setPhotoFocusAt.mockClear();const dot=host.querySelector<HTMLElement>('.photo-focus-dot')!;
 await act(async()=>{dot.dispatchEvent(Object.assign(new MouseEvent('pointerdown',{bubbles:true,clientX:160,clientY:370}),{pointerId:2}));});
 expect(editor.setPhotoFocusAt.mock.calls.at(-1)?.[0]).toBe(1);expect(editor.setPhotoFocusAt.mock.calls.at(-1)?.[1]).toBeCloseTo(0);expect(dot.style.left).toBe('87.5%');expect(dot.style.top).toBe('50%');
});
it('keeps the selected pose and its adjustment controls across a shot and continue',async()=>{
 await setup([{id:'a',label:'小白'},{id:'b',label:'小绿'}]);await click('动作');
 const first=host.querySelector<HTMLButtonElement>('.photo-action-grid button')!;await act(async()=>first.click());const selected=host.querySelector('.photo-action-preview strong')!.textContent;
 await click('拍下合影');await click('继续拍');expect(host.querySelector('.photo-action-preview strong')?.textContent).toBe(selected);await click('选择动作');await click('镜头');expect(host.querySelector('.photo-formats')).toBeTruthy();
});
