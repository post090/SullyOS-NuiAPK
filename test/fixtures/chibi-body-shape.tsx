import React from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {CreatorRollBridge} from '../../apps/room3d/chibi/CreatorRollBridge';
import {decodeParts} from '../../apps/room3d/chibi/visitor';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildBody,loadBody} from '../../apps/room3d/chibi/FbxBody';
import {createPoseEditor} from './chibi-pose-editor';
import {createPoseHandles} from './chibi-pose-handles';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';


const w=window as any;
function Bridge(){const [request,setRequest]=React.useState(0);return <CreatorRollBridge request={request} onReady={()=>setRequest(1)} onError={e=>{throw Error(e)}} onResult={async result=>{
 if(w.bodyReady)return;
 const parts=await decodeParts(result),source=await loadBody();
 const scene=new T.Scene();scene.background=new T.Color('#f4eee8');scene.add(new T.HemisphereLight('#ffffff','#e5dce4',2));
 const key=new T.DirectionalLight('#fff8ef',1.1);key.position.set(-3,5,5);scene.add(key);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(1000,650);document.querySelector('#stage')!.append(renderer.domElement);
 const camera=new T.OrthographicCamera(-3.6,3.6,2.65,-2.65,.1,30);camera.position.set(0,2.65,7);camera.lookAt(0,2.65,0);
 const bodies=(['outfit','skin'] as const).map((appearance,index)=>{
  const body=buildBody(source,parts,appearance,{layers:{},extras:[],bodyShape:'blank'});
  body.root.position.x=index?1.65:-1.65;
  if(index){
   const mesh=body.root.getObjectByName('chibi-body') as T.Mesh;
   // Plain skin across the intact mesh: no painted eyes, mouth or scalp.
   mesh.material=(mesh.material as T.Material[])[1];
  }
  scene.add(body.root);return body;
 });
 const outfit=dressHoodie(bodies[0].rig!);bodies[0].resources.push(...outfit.resources);
 const skeletons=bodies.map(b=>{const helper=new T.SkeletonHelper(b.rig!.mesh);helper.visible=false;helper.material.depthTest=false;helper.renderOrder=10;scene.add(helper);return helper;});
 let currentYaw=0,currentPose='relaxed';
 let poseEditor:ReturnType<typeof createPoseEditor>|undefined;
 let poseHandles:ReturnType<typeof createPoseHandles>|undefined;
 const render=()=>{poseHandles?.update();renderer.render(scene,camera);};
 const draw=(applyEditor=true)=>{for(const body of bodies){body.rig!.setPose(currentPose as any);if(applyEditor)poseEditor?.apply(body.rig!);body.root.rotation.y=currentYaw;}render();};
 bodies.forEach(b=>b.rig!.setPose('relaxed'));
 poseEditor=createPoseEditor(document.querySelector('#pose-controls')!,bodies[0].rig!,()=>draw());
 poseHandles=createPoseHandles(scene,camera,renderer.domElement,bodies.map(b=>b.rig!),poseEditor,render);
 w.poseHandles=()=>poseHandles!.toggle();
 w.clothes=()=>{outfit.setVisible(!outfit.meshes[0].visible);draw();};
 w.outfitCheck=()=>({triangles:outfit.triangles,meshes:outfit.meshes.map(m=>{m.geometry.computeBoundingBox();return {name:m.name,bounds:m.geometry.boundingBox,vertices:m.geometry.attributes.position.count};})});
 const storageKey='tiny-t-pose-face-placement-v1';
 const placement={eyes:{x:0,y:-16},mouth:{x:0,y:-16}};
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
  for(const part of ['eyes','mouth'] as const)for(const axis of ['x','y'] as const){const value=saved?.[part]?.[axis];if(Number.isFinite(value))placement[part][axis]=T.MathUtils.clamp(value,-80,80);}
 }catch{/* A missing or invalid draft uses the initial face placement. */}
 const controls=document.querySelector('#face-controls')!;
 const applyPlacement=()=>{bodies[0].setFacePlacement(placement);try{localStorage.setItem(storageKey,JSON.stringify(placement));}catch{}draw();};
 for(const [part,label] of [['eyes','眼睛'],['mouth','嘴巴']] as const){
  const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=label;group.append(legend);
  for(const [axis,label] of [['x','左右'],['y','上下']] as const){
   const row=document.createElement('label');row.textContent=label;
   const slider=document.createElement('input'),number=document.createElement('input');slider.type='range';number.type='number';
   for(const input of [slider,number]){input.min='-80';input.max='80';input.step='1';input.value=String(placement[part][axis]);input.dataset.part=part;input.dataset.axis=axis;input.setAttribute('aria-label',`${legend.textContent}${label}${input===number?'数值':''}`);}
   const update=(value:number)=>{placement[part][axis]=T.MathUtils.clamp(value,-80,80);slider.value=number.value=String(placement[part][axis]);applyPlacement();};
   slider.oninput=()=>update(slider.valueAsNumber);number.oninput=()=>{if(Number.isFinite(number.valueAsNumber))update(number.valueAsNumber);};
   row.append(slider,number);group.append(row);
  }controls.append(group);
 }
 const reset=document.createElement('button');reset.textContent='重置五官位置';reset.onclick=()=>{
  for(const part of ['eyes','mouth'] as const)placement[part]={x:0,y:-16};
  controls.querySelectorAll('input').forEach(input=>input.value=input.dataset.axis==='y'?'-16':'0');applyPlacement();
 };controls.append(reset);bodies[0].setFacePlacement(placement);
 w.pose=(_motion='idle',yaw=0)=>{currentYaw=yaw;draw();};
 w.rigPose=(pose:string)=>{currentPose=pose;draw(false);poseEditor!.usePreset();draw();};
 w.poseSnapshot=()=>poseEditor!.snapshot();
 w.skeleton=()=>{skeletons.forEach(h=>h.visible=!h.visible);draw();};

 w.exportRig=async()=>{const body=bodies[1],position=body.root.position.clone(),visible=body.root.visible;try{body.rig!.setPose('bind');body.root.position.set(0,0,0);body.root.visible=true;body.root.updateMatrixWorld(true);const glb=await new GLTFExporter().parseAsync(body.root,{binary:true,onlyVisible:true});return Array.from(new Uint8Array(glb as ArrayBuffer));}finally{body.root.position.copy(position);body.root.visible=visible;draw();}};
 w.downloadRig=async()=>{const bytes=await w.exportRig(),url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='Tiny-T-Pose-Figure-rigged.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 w.face=()=>{const close=camera.zoom===1;camera.zoom=close?2.1:1;bodies[1].root.visible=!close;camera.position.set(close?-1.65:0,close?4.5:2.65,7);camera.lookAt(camera.position.x,camera.position.y,0);camera.updateProjectionMatrix();draw();};
 const resize=()=>{const width=document.querySelector('#stage')!.clientWidth,height=Math.max(450,innerHeight-document.querySelector('header')!.offsetHeight),aspect=width/height,half=Math.max(3.15,3.65/aspect);renderer.setSize(width,height);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();draw();};
 window.addEventListener('resize',resize);resize();
 w.bodyCheck=()=>{
  const mesh=bodies[1].root.getObjectByName('chibi-body') as T.Mesh;
  const p=mesh.geometry.getAttribute('position');let finite=true;
  for(let i=0;i<p.count;i++)finite&&=Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i));
  const face=bodies[0].root.getObjectByName('chibi-body') as T.Mesh;const faceTexture=(face.material as T.MeshStandardMaterial[])[0].map!;
  return {finite,rig:bodies[1].rig!.inspect(),faceTextureSize:[faceTexture.image.width,faceTexture.image.height],vertices:p.count,triangles:mesh.geometry.index!.count/3,onePiece:true};
 };
 draw();w.bodyReady=true;
}}/>;}
createRoot(document.querySelector('#bridge')!).render(<Bridge/>);
