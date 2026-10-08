import {cleanFace,composeFace,loadFaceImages} from '../../apps/room3d/chibi/faceAppearance';

const result=document.querySelector('#result')!;
const pixels=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,472,472).data;
const canvas=(...sources:CanvasImageSource[])=>{const c=document.createElement('canvas');c.width=c.height=472;for(const s of sources)c.getContext('2d')!.drawImage(s,0,0,472,472);return c;};
const same=(a:HTMLCanvasElement,b:HTMLCanvasElement,label:string)=>{const x=pixels(a),y=pixels(b);if(x.some((v,i)=>Math.abs(v-y[i])>1))throw Error(label);};
try{
 const face=cleanFace({eyeArtwork:'sully',useBaseEyes:false}),images=await loadFaceImages(face);
 const normal=composeFace(face,images).eyes,none=composeFace({...face,brow:'none'},images).eyes;
 same(normal,canvas(images.sully,images['brow-sully']),'默认分层改变了原画配准');
 same(none,canvas(images.sully),'取下眉毛影响了眼睛');
 const moved=composeFace({...face,adjustments:{brow:{y:12}}},images).eyes;
 const expected=canvas(images.sully);expected.getContext('2d')!.drawImage(images['brow-sully'],0,12,472,472);
 same(moved,expected,'眉毛移动没有独立生效');
 for(const state of ['closed','happy'] as const){
  const a=composeFace(face,images,state).eyes,b=composeFace({...face,brow:'none'},images,state).eyes;
  b.getContext('2d')!.drawImage(images['brow-sully'],0,0,472,472);same(a,b,`${state} 丢失或重复眉毛`);
 }
 const dyed=composeFace({...face,baseIrisColor:'#6b9b83'},images).eyes;
 const a=pixels(normal),b=pixels(dyed),mask=pixels(canvas(images['brow-sully']));
 for(let i=0;i<a.length;i+=4)if(mask[i+3]===255&&[0,1,2,3].some(k=>a[i+k]!==b[i+k]))throw Error('眼睛染色改动了眉毛');
 document.querySelector('#samples')!.append(normal,none,moved,dyed);
 result.textContent='PASS · 6 项像素检查：原画配准、独立取下、独立位移、闭眼眉毛、开心眉毛、眼色不染眉毛';
}catch(error){result.textContent=`FAIL · ${error}`;throw error;}
