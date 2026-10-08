import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import {BLANK_SCALE} from './blankBody';
import {constrainForearmTwist} from '../../../experiments/chibi/forearmTwist';
import type {bindBlankBody} from './blankRig';
import type {ActivityPose} from './types';

export function bathroomFrame(time:number){
 const s=T.MathUtils.smootherstep,t=Math.max(0,time);
 return {wash:s(t,.3,1.2)*(1-s(t,9.8,11.5)),press:s(t,.3,1.1)*(1-s(t,2.6,3.3)),breathe:Math.sin(t*1.6)};
}
/** Furniture contact and head-relative palms reuse the existing Three IK solver. */
export function createBathroomContact(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const goals=[new T.Bone(),new T.Bone()],bones=[...rig.skeleton.bones,...goals],index=(n:string)=>bones.indexOf(rig.bones[n]);
 const chains=['L','R'].map((s,i)=>({target:rig.skeleton.bones.length+i,effector:index(s+'_hand'),iteration:30,maxAngle:.12,links:[{index:index(s+'_forearm')},{index:index(s+'_upperArm')}]}));
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains),point=new T.Vector3(),rotation=new T.Quaternion(),parentQ=new T.Quaternion();
 const pose=Object.fromEntries(Object.keys(rig.bones).map(n=>[n,new T.Quaternion()]));
 return (time:number,a:ActivityPose)=>{
  if(!a.kind.startsWith('bath-')||a.bathPhase&&a.bathPhase!=='work'||!body.parent)return;
  const f=bathroomFrame(time);body.updateWorldMatrix(true,true);
  for(const [i,side,sign] of [[0,'L',1],[1,'R',-1]] as const){
   let weight=0;
   if(a.kind==='bath-shower'){
    // Palms beside the hair, alternating small rubs; no hands through the face.
    point.set(sign*.16*BLANK_SCALE,(.095+Math.sin(time*3+i*Math.PI)*.01)*BLANK_SCALE,.04*BLANK_SCALE);
    rig.bones.head.localToWorld(point);weight=f.wash;
   }else if(a.kind==='bath-soak'&&a.bathHands?.[i]){
    point.fromArray(a.bathHands[i]).multiplyScalar(a.handScale??1);body.parent.localToWorld(point);weight=T.MathUtils.smootherstep(time,0,.65);
   }else if(a.kind==='bath-laundry'&&side==='R'&&a.bathHands?.[0]){
    point.fromArray(a.bathHands[0]);point.z+=Math.sin(time*8)*.012*f.press;
    point.multiplyScalar(a.handScale??1);body.parent.localToWorld(point);weight=f.press;
   }
   if(!weight)continue;
   const hand=rig.bones[side+'_hand'];hand.getWorldQuaternion(rotation);
   goals[i].matrixWorld.makeTranslation(point.x,point.y,point.z);solver.updateOne(chains[i],weight);
   // Keep the authored wrist orientation while the elbow solves the contact.
   hand.parent!.getWorldQuaternion(parentQ);hand.quaternion.copy(parentQ.invert().multiply(rotation));
   rig.setHandCurl(side,a.kind==='bath-laundry'?.22:.08);
   for(const [name,bone]of Object.entries(rig.bones))pose[name].copy(bone.quaternion);
   constrainForearmTwist(rig,pose,side);for(const suffix of ['twist1','twist2','twist3'])rig.bones[side+'_'+suffix]?.quaternion.copy(pose[side+'_'+suffix]);
   body.updateWorldMatrix(true,true);
  }
 };
}
