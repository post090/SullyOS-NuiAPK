import * as T from 'three';
import {wateringFrame} from './chibi/roomMotionFrame.ts';
// Tiny shared meshes, no textures, particles or extra animation loop.
export function createWateringEffect(){
 const root=new T.Group(),can=new T.Group();root.name='watering-effect';can.name='watering-can';root.add(can);root.visible=false;
 const mint=new T.MeshStandardMaterial({color:'#a5bfaf',roughness:.8}),water=new T.MeshBasicMaterial({color:'#92c9e0'});
 function add(g,m,p,rotation){const o=new T.Mesh(g,m);o.position.fromArray(p);if(rotation)o.rotation.fromArray(rotation);can.add(o);return o;}
 add(new T.CylinderGeometry(.11,.13,.18,16),mint,[0,0,0]);
 add(new T.TorusGeometry(.105,.022,6,16),mint,[-.12,.03,0],[0,Math.PI/2,0]);
 const start=new T.Vector3(0,-.02,.08),end=new T.Vector3(0,.05,.34),spout=add(new T.CylinderGeometry(.025,.042,start.distanceTo(end),10),mint,start.clone().add(end).multiplyScalar(.5).toArray());spout.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize());
 const drops=Array.from({length:7},()=>{const o=new T.Mesh(new T.SphereGeometry(.013,6,4),water);root.add(o);return o;});
 const source=new T.Vector3(),target=new T.Vector3(),gripOffset=new T.Vector3(.15,-.025,.035);
 return {root,update(time,spot,hands){
  root.visible=!!spot;if(!spot)return;
  const frame=hands?wateringFrame(time):null;
  can.scale.setScalar(hands?1.25:1);
  if(hands){
   // Body-2 wrists in resident coordinates: the handle follows the right hand.
   // The other hand supports the opposite side; never reuse the round-body socket.
   can.position.fromArray(hands[0]).add(gripOffset);
   can.rotation.set(frame.tilt,0,0);can.visible=frame.reach>.03;
  }else{can.position.set(.08,.36,.36);can.rotation.set(.25+.07*Math.sin(time*2),0,0);can.visible=true;}
  can.updateMatrix();source.set(0,.05,.34).applyMatrix4(can.matrix);
  const distance=Math.hypot(spot.target[0]-spot.position[0],spot.target[2]-spot.position[2]);
  target.set(0,spot.target[1]-.18,distance);
  drops.forEach((o,i)=>{o.visible=!frame||frame.pour>.15;const u=(time*1.1+i/7)%1;o.position.lerpVectors(source,target,u);o.position.y+=Math.sin(u*Math.PI)*.025;});
 },dispose(){root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});mint.dispose();water.dispose();}};
}
