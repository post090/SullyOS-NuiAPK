import * as T from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import type {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import type {createPoseEditor} from './chibi-pose-editor';

export function createPoseHandles(scene:T.Scene,camera:T.Camera,canvas:HTMLCanvasElement,rigs:ReturnType<typeof bindBlankBody>[],editor:ReturnType<typeof createPoseEditor>,render:()=>void){
 const controls=new TransformControls(camera,canvas);controls.setMode('rotate');controls.setSpace('local');controls.setSize(.65);
 const helper=controls.getHelper();scene.add(helper);
 const group=new T.Group();scene.add(group);
 const geometry=new T.BoxGeometry(.075,.075,.075);
 const markers:Array<T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>>=[];
 rigs.forEach((rig,index)=>Object.entries(rig.bones).forEach(([name,bone])=>{
  const marker=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0x35bccb,wireframe:true,depthTest:false,depthWrite:false,transparent:true,opacity:.9}));
  if(/_(thumb|index|middle|ring|pinky)/.test(name))marker.scale.setScalar(.32);
  marker.renderOrder=100;marker.userData={name,bone,index};group.add(marker);markers.push(marker);
 }));
 let activeRig=1,selected='L_upperArm',enabled=true;
 const attach=()=>{controls.attach(rigs[activeRig].bones[selected]);for(const marker of markers)marker.material.color.setHex(marker.userData.name===selected?0xffad32:0x35bccb);};
 editor.onSelection(name=>{selected=name;attach();render();});
 controls.addEventListener('objectChange',()=>{editor.setRotation(selected,rigs[activeRig].bones[selected].rotation.clone());});
 // Hover/drag updates the helper without resetting the current pose.
 controls.addEventListener('change',()=>render());
 const raycaster=new T.Raycaster(),pointer=new T.Vector2();
 canvas.addEventListener('pointerdown',event=>{
  if(!enabled||controls.dragging||event.button!==0)return;
  const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(markers.filter(m=>m.visible),false)[0];if(!hit)return;
  activeRig=hit.object.userData.index;editor.selectBone(hit.object.userData.name);
 });
 attach();
 return {
  update(){for(const marker of markers){const rig=rigs[marker.userData.index];let visible=true;rig.mesh.traverseAncestors(o=>{visible&&=o.visible;});marker.visible=visible;marker.userData.bone.getWorldPosition(marker.position);}
   if(activeRig===1&&!markers.find(m=>m.userData.index===1)?.visible){activeRig=0;attach();}
  },
  toggle(){enabled=!enabled;group.visible=enabled;controls.enabled=enabled;helper.visible=enabled;render();},
 };
}
