import * as T from 'three';
import {createBlankBody} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';
import {createWardrobePose,createWardrobeEntrance,type WardrobeStyle} from '../../experiments/chibi/wardrobePose';

const scene=new T.Scene();scene.background=new T.Color('#eee9e3');
scene.add(new T.HemisphereLight('#fff9ef','#aa98b3',2.1));const light=new T.DirectionalLight('#fff',2.2);light.position.set(3,6,5);scene.add(light);
const root=new T.Group(),hair=new T.Group();
const mesh=new T.Mesh(createBlankBody('skin'),Array.from({length:6},()=>new T.MeshStandardMaterial({color:'#eed5c4',roughness:1})));
root.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true),outfit=dressHoodie(rig);
let style:WardrobeStyle=new URLSearchParams(location.search).get('style')==='boy'?'boy':new URLSearchParams(location.search).get('style')==='normal'?'normal':'cute';
let clip=createWardrobePose(rig,style),entrance=createWardrobeEntrance(rig,clip),total=entrance.duration+clip.duration;
const mixer=new T.AnimationMixer(root);let action=mixer.clipAction(clip),entryAction=mixer.clipAction(entrance);
action.play();entryAction.play();action.paused=true;entryAction.paused=true;
function sample(t:number){
 const entering=t<entrance.duration;action.enabled=!entering;entryAction.enabled=entering;
 entryAction.time=Math.min(t,entrance.duration);action.time=Math.max(0,t-entrance.duration)%clip.duration;mixer.update(0);
}
sample(0);
root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),scale=2.5/(box.max.y-box.min.y);
const wrapper=new T.Group();wrapper.add(root);wrapper.scale.setScalar(scale);wrapper.position.y=-box.min.y*scale;scene.add(wrapper);
const helper=new T.SkeletonHelper(root);helper.visible=false;scene.add(helper);
const grid=new T.GridHelper(5,10,'#bcb0b9','#d6ccd1');grid.position.y=-.01;scene.add(grid);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,1,.01,100),views=[0,Math.PI/2,Math.PI,Math.PI/4];let dressed=true,standing=true,playing=true,time=0,previous=0;
const facePosition=new T.Vector3(),faceForward=new T.Vector3(),faceRotation=new T.Quaternion();
function draw(){
 const width=innerWidth,height=Math.min(620,Math.max(340,innerWidth*.5));renderer.setSize(width,height,false);renderer.domElement.style.height=`${height}px`;
 camera.aspect=(width/4)/height;camera.updateProjectionMatrix();root.updateMatrixWorld(true);rig.skeleton.update();
 for(const m of [rig.mesh,...outfit.meshes]){m.frustumCulled=false;m.boundingBox=null;m.boundingSphere=null;}
 const close=new URLSearchParams(location.search).has('close');
 const distance=close?4.2:standing?6.5:8.5;
 rig.bones.head.getWorldPosition(facePosition);rig.bones.head.getWorldQuaternion(faceRotation);
 faceForward.set(0,0,1).applyQuaternion(faceRotation);
 const faceYaw=Math.atan2(faceForward.x,faceForward.z);
 renderer.setScissorTest(true);views.forEach((angle,i)=>{
  const yaw=i===0?faceYaw:angle,x=i===0?facePosition.x:0,z=i===0?facePosition.z:0;
  camera.position.set(x+Math.sin(yaw)*distance,1.9,z+Math.cos(yaw)*distance);camera.lookAt(x,close?1.38:1.25,z);
  renderer.setViewport(i*width/4,0,width/4,height);renderer.setScissor(i*width/4,0,width/4,height);renderer.render(scene,camera);
 });renderer.setScissorTest(false);
 document.querySelector('#status')!.textContent=`${standing?(time<entrance.duration?'站立 → 试衣':'试衣循环'):'T 姿势'} · ${dressed?'卫衣':'素体'} · ${time.toFixed(2)} / ${total.toFixed(2)} 秒`;
}
document.querySelector('#outfit')!.addEventListener('click',e=>{dressed=!dressed;outfit.setVisible(dressed);(e.target as HTMLElement).textContent=dressed?'切换素体':'穿上卫衣';draw();});
document.querySelector('#pose')!.addEventListener('click',e=>{standing=!standing;if(standing){action.play();entryAction.play();time=0;sample(time);}else{mixer.stopAllAction();rig.setPose('bind');}(e.target as HTMLElement).textContent=standing?'查看 T 姿势':'试衣站姿';draw();});
document.querySelector('#bones')!.addEventListener('click',e=>{helper.visible=!helper.visible;(e.target as HTMLElement).textContent=helper.visible?'隐藏骨架':'显示骨架';draw();});
const slider=document.querySelector<HTMLInputElement>('#time')!;
const styleSelect=document.querySelector<HTMLSelectElement>('#style')!;styleSelect.value=style;
styleSelect.addEventListener('change',()=>{
 mixer.stopAllAction();mixer.uncacheClip(clip);mixer.uncacheClip(entrance);rig.setPose('bind');
 style=styleSelect.value as WardrobeStyle;clip=createWardrobePose(rig,style);entrance=createWardrobeEntrance(rig,clip);total=entrance.duration+clip.duration;
 action=mixer.clipAction(clip);entryAction=mixer.clipAction(entrance);action.play();entryAction.play();action.paused=true;entryAction.paused=true;
 time=0;standing=true;playing=true;slider.value='0';sample(0);document.querySelector('#play')!.textContent='暂停动画';document.querySelector('#pose')!.textContent='查看 T 姿势';draw();
});
document.querySelector('#play')!.addEventListener('click',e=>{playing=!playing;(e.target as HTMLElement).textContent=playing?'暂停动画':'播放动画';});
document.querySelector('#replay')!.addEventListener('click',()=>{standing=true;playing=true;time=0;action.play();entryAction.play();sample(0);slider.value='0';document.querySelector('#play')!.textContent='暂停动画';document.querySelector('#pose')!.textContent='查看 T 姿势';draw();});
slider.max=String(total);
slider.addEventListener('input',()=>{playing=false;document.querySelector('#play')!.textContent='播放动画';time=Number(slider.value);if(standing)sample(time);draw();});
function frame(now:number){
 const dt=previous?Math.min((now-previous)/1000,.1):0;previous=now;
 if(standing&&playing){time+=dt;if(time>=total)time=entrance.duration+(time-entrance.duration)%clip.duration;sample(time);slider.value=String(time);draw();}
 requestAnimationFrame(frame);
}
addEventListener('resize',draw);draw();requestAnimationFrame(frame);
