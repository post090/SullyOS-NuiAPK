// @vitest-environment jsdom
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {FaceControls} from '../experiments/chibi/FaceControls';
import {cleanFace} from '../apps/room3d/chibi/faceAppearance';
import type {HairSettings} from '../apps/room3d/chibi/types';
vi.mock('../apps/room3d/chibi/faceAppearance',async importOriginal=>({...await importOriginal<any>(),loadFaceImages:()=>Promise.reject(new Error('No canvas in UI test'))}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>,host:HTMLDivElement;
afterEach(()=>{act(()=>root.unmount());host.remove();});
it('inherits both colors, edits one eye, preserves the other across eye presets and joins back to one color',()=>{
 let latest:HairSettings;
 function App(){const [hair,setHair]=useState<HairSettings>({layers:{},extras:[],face:cleanFace({useBaseEyes:true})});latest=hair;return React.createElement(FaceControls,{section:'eyes',hair,sourceEyeColors:{L:'#ff0000',R:'#0000ff'},onChange:setHair,onBegin:()=>{},onEnd:()=>{},mouthUse:'closed',onMouthUse:()=>{}});}
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);act(()=>root.render(React.createElement(App)));
 const click=(name:string)=>act(()=>host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!.click());
 const value=(name:string)=>host.querySelector<HTMLInputElement>(`[aria-label="${name}"]`)!.value;
 expect(value('画面右眼颜色值')).toBe('#0000ff');
 click('画面左眼 #6b9b83');expect(latest!.face!.useBaseEyes).toBe(true);expect(value('画面右眼颜色值')).toBe('#0000ff');
 click('眼型 02');expect(latest!.face).toMatchObject({useBaseEyes:false,upper:'02',irisColors:{L:'#6b9b83',R:'#0000ff'}});
 click('画面右眼 #b78254');expect(latest!.face!.irisColors).toEqual({L:'#6b9b83',R:'#b78254'});
 act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='同色')!.click());
 expect(latest!.face).toMatchObject({heterochromia:false,irisColor:'#6b9b83',baseIrisColor:'#6b9b83'});expect(latest!.face!.irisColors).toBeUndefined();
});
