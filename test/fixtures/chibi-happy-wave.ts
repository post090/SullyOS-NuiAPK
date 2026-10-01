import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlankBody} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';
import {retargetHappyWave} from '../../experiments/chibi/retargetHappyWave';

async function main(){
 const source=await new GLTFLoader().loadAsync('/room3d/animations/happy-wave-source.glb');
 const original=source.animations[0],roots:T.Object3D[]=[source.scene],clips:T.AnimationClip[]=[original];
 for(const dressed of [false,true]){
  const root=new T.Group(),hair=new T.Group(),g=createBlankBody('skin');
  root.add(new T.Mesh(g,Array.from({length:6},()=>new T.MeshStandardMaterial({color:'#eed5c4',roughness:1}))),hair);
  const rig=bindBlankBody(root.children[0] as T.Mesh,hair);
  if(dressed)dressHoodie(rig);
  clips.push(retargetHappyWave(source.scene,original,rig));roots.push(root);
 }
 const helpers:T.SkeletonHelper[]=[],mixers:T.AnimationMixer[]=[],actions:T.AnimationAction[]=[],skins:T.SkinnedMesh[]=[];
 const scenes=roots.map((root,i)=>{
  const scene=new T.Scene();scene.background=new T.Color(i===1?'#e8e1de':'#eee9e3');
  scene.add(new T.HemisphereLight('#fff9ef','#aa98b3',2.1));const light=new T.DirectionalLight('#ffffff',2.2);light.position.set(3,6,5);scene.add(light);
  root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),scale=2.5/(box.max.y-box.min.y);
  const wrapper=new T.Group();wrapper.add(root);wrapper.scale.setScalar(scale);wrapper.position.y=-box.min.y*scale;scene.add(wrapper);
  const helper=new T.SkeletonHelper(root);helper.visible=false;helpers.push(helper);scene.add(helper);
  root.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh){const skin=o as T.SkinnedMesh;skin.frustumCulled=false;skins.push(skin);}});
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clips[i]);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();mixers.push(mixer);actions.push(action);
  const grid=new T.GridHelper(5,10,'#bcb0b9','#d6ccd1');grid.position.y=-.04;scene.add(grid);return scene;
 });
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(40,1,.01,100),slider=document.querySelector<HTMLInputElement>('#time')!,status=document.querySelector('#status')!;
 let time=0,playing=true,side=false,previous=performance.now();
 function draw(){
  const width=innerWidth,height=Math.min(620,Math.max(320,innerWidth*.5));renderer.setSize(width,height,false);renderer.domElement.style.height=`${height}px`;
  camera.aspect=(width/3)/height;camera.position.set(side?6.5:0,2.1,side?0:6.5);camera.lookAt(0,1.35,0);camera.updateProjectionMatrix();
  mixers.forEach((m,i)=>{actions[i].paused=false;m.setTime(time);});skins.forEach(s=>{s.boundingBox=null;s.boundingSphere=null;});
  renderer.setScissorTest(true);scenes.forEach((scene,i)=>{renderer.setViewport(i*width/3,0,width/3,height);renderer.setScissor(i*width/3,0,width/3,height);renderer.render(scene,camera);});renderer.setScissorTest(false);
  slider.value=String(time);status.textContent=`${time.toFixed(2)} / ${original.duration.toFixed(2)} 秒`;
 }
 document.querySelector('#play')!.addEventListener('click',e=>{playing=!playing;(e.target as HTMLElement).textContent=playing?'暂停':'播放';});
 document.querySelector('#front')!.addEventListener('click',()=>{side=false;draw();});
 document.querySelector('#side')!.addEventListener('click',()=>{side=true;draw();});
 document.querySelector('#bones')!.addEventListener('click',()=>{helpers.forEach(h=>h.visible=!h.visible);draw();});
 slider.addEventListener('input',()=>{playing=false;document.querySelector('#play')!.textContent='播放';time=Number(slider.value);draw();});
 Object.assign(window,{happyWaveReady:true,setHappyWaveTime:(t:number)=>{playing=false;time=T.MathUtils.clamp(t,0,original.duration);draw();}});
 function frame(now:number){if(playing)time=(time+Math.min((now-previous)/1000,.1))%original.duration;previous=now;draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
main().catch(error=>{document.querySelector('#status')!.textContent=`加载失败：${error.message}`;console.error(error);});
