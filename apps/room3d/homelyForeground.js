import * as THREE from 'three';
import {homelyPeekTarget} from './homelyPresence';

/** Reuse the live resident and WebGL context. Only the transparent actor pass
 * crosses the DOM chat; the room camera, scene graph and saved location do not. */
export function createHomelyForeground({renderer,scene,camera,resident,container,stage}) {
 const canvas=document.createElement('canvas');
 canvas.className='homely-foreground';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;
 container.append(canvas);
 const context=canvas.getContext('2d'),frontCamera=camera.clone();
 const hide=()=>{canvas.hidden=true;};
 function capture(weight,head) {
  const panel=container.querySelector('.homely-chat .home-life-sheet');
  if(!context||!panel||!head||weight<=0){hide();return;}
  const bounds=stage.getBoundingClientRect(),chat=panel.getBoundingClientRect();
  if(!bounds.width||!bounds.height){hide();return;}
  const width=Math.round(bounds.width),height=Math.round(bounds.height);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const parent=container.getBoundingClientRect();
  Object.assign(canvas.style,{left:`${bounds.left-parent.left}px`,top:`${bounds.top-parent.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`});
  const projected=head.clone().project(camera),origin={x:(projected.x+1)*width/2,y:(1-projected.y)*height/2};
  const target=homelyPeekTarget({left:chat.left-bounds.left,top:chat.top-bounds.top,width:chat.width,height:chat.height});
  const x=THREE.MathUtils.lerp(origin.x,target.x,weight),y=THREE.MathUtils.lerp(origin.y,target.y,weight);
  frontCamera.copy(camera);frontCamera.zoom=camera.zoom*(1+.18*weight);frontCamera.updateProjectionMatrix();frontCamera.updateMatrixWorld();
  const desired=new THREE.Vector3(x/width*2-1,1-y/height*2,projected.z).unproject(frontCamera);
  frontCamera.position.add(head.clone().sub(desired));frontCamera.updateMatrixWorld();frontCamera.layers.set(31);
  const layers=[],background=scene.background,shadow=renderer.shadowMap.enabled;
  const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
  const include=o=>{layers.push([o,o.layers.mask]);o.layers.enable(31);};
  resident.traverse(include);scene.traverse(o=>{if(o.isLight)include(o);});
  try{
   scene.background=null;renderer.shadowMap.enabled=false;renderer.setClearColor(0,0);
   renderer.render(scene,frontCamera);
   context.clearRect(0,0,width,height);context.drawImage(renderer.domElement,0,0,width,height);
   canvas.hidden=false;
  }finally{
   layers.forEach(([o,mask])=>{o.layers.mask=mask;});scene.background=background;
   renderer.shadowMap.enabled=shadow;renderer.setClearColor(clearColor,clearAlpha);
  }
  // Render exactly one resident: omit the room copy while the actor is in front.
  const visible=resident.visible;resident.visible=false;
  return ()=>{resident.visible=visible;};
 }
 return {capture,hide,dispose(){canvas.remove();}};
}
