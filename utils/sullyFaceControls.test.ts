// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {FaceControls} from '../experiments/chibi/FaceControls';
import {cleanFace} from '../apps/room3d/chibi/faceAppearance';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.appendChild(host);
let root:ReturnType<typeof createRoot>;
afterEach(()=>act(()=>root.unmount()));
function render(allowSully:boolean){
 const onChange=vi.fn();root=createRoot(host);
 const hair={layers:{},extras:[],face:cleanFace({eyeArtwork:'sully',useBaseEyes:false})};
 act(()=>root.render(React.createElement(FaceControls,{section:'brows',allowSully,hair,onChange,onBegin:()=>{},onEnd:()=>{},mouthUse:'closed',onMouthUse:()=>{}})));
 return onChange;
}
it('changes or removes brows without replacing Sully eyes',()=>{
 const changed=render(true);
 for(const [label,brow] of [['眉毛款式 02','02'],['眉毛款式 无','none'],['眉毛款式 sully','sully']]){
  act(()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  expect(changed.mock.lastCall![0].face).toMatchObject({eyeArtwork:'sully',useBaseEyes:false,brow});
 }
});
it('does not offer exclusive brows to another character',()=>{
 render(false);expect(host.querySelector('[aria-label="眉毛款式 sully"]')).toBeNull();
});
