import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import type {ChibiVisitor} from './visitor';
import {furnitureHandRotation,furniturePalm} from './furnitureMotion';
import {constrainForearmTwist} from '../../../experiments/chibi/forearmTwist';
export type Contact={side:'R'|'L';point:T.Vector3;direction:T.Vector3;normal:T.Vector3;curl?:number};
export function contactSolver(visitor:ChibiVisitor){
 const rig=visitor.rig;if(!rig)return null;
 const goals=[new T.Bone(),new T.Bone()],bones=[...rig.skeleton.bones,...goals];
 const chains=['R','L'].map((side,i)=>({target:rig.skeleton.bones.length+i,effector:bones.indexOf(rig.bones[side+'_hand']),iteration:48,maxAngle:.16,links:['forearm','upperArm'].map(n=>({index:bones.indexOf(rig.bones[side+'_'+n])}))}));
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains);
 const pose=Object.fromEntries(Object.keys(rig.bones).map(n=>[n,new T.Quaternion()]));
 return (contact:Contact,weight:number)=>{
  const i=contact.side==='R'?0:1,hand=rig.bones[contact.side+'_hand'];
  const rotation=furnitureHandRotation(contact.side,contact.direction.toArray(),contact.normal.toArray());
  const scale=hand.getWorldScale(new T.Vector3()).y;
  const wrist=contact.point.clone().sub(furniturePalm(contact.side).multiplyScalar(scale).applyQuaternion(rotation));
  goals[i].matrixWorld.makeTranslation(wrist.x,wrist.y,wrist.z);solver.updateOne(chains[i],weight);
  const local=hand.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation);
  hand.quaternion.slerp(local,weight);
  // A caller with individually authored fingers owns its own hand shape.
  if(contact.curl!==undefined)rig.setHandCurl(contact.side,contact.curl*weight);
  for(const [n,b] of Object.entries(rig.bones))pose[n].copy(b.quaternion);
  constrainForearmTwist(rig,pose,contact.side);
  for(const suffix of ['twist1','twist2','twist3'])rig.bones[contact.side+'_'+suffix]?.quaternion.copy(pose[contact.side+'_'+suffix]);
  visitor.root.updateWorldMatrix(true,true);
 };
}
