import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import type {bindBlankBody} from './blankRig';
import type {ActivityPose} from './types';
import {constrainForearmTwist} from '../../../experiments/chibi/forearmTwist';
export function computerFrame(time:number,stream=false){
 const t=Math.max(0,time),cycle=t%12,smooth=T.MathUtils.smootherstep;
 const mouse=smooth(cycle,4.8,5.8)*(1-smooth(cycle,9.2,10.2));
 const greet=stream?smooth(t,.65,1.15)*(1-smooth(t,3.3,3.85)):0;
 return {enter:smooth(t,0,.85),greet,mouse,tap:(1-mouse)*(.5+.5*Math.sin(t*8)),look:Math.sin(t*.65)*.025};
}
/** Wrist goals follow the actual desk inputs; keep original bone lengths. */
export function createComputerContact(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const goals=[new T.Bone(),new T.Bone()],bones=[...rig.skeleton.bones,...goals];
 const index=(n:string)=>bones.indexOf(rig.bones[n]);
 const chains=['L','R'].map((side,i)=>({target:rig.skeleton.bones.length+i,effector:index(side+'_hand'),iteration:32,maxAngle:.12,links:[{index:index(side+'_forearm')},{index:index(side+'_upperArm')}]}));
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains),p=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion(),axis=new T.Vector3(0,1,0);
 const pose=Object.fromEntries(Object.keys(rig.bones).map(n=>[n,new T.Quaternion()]));
 return (time:number,activity:ActivityPose)=>{
  if(activity.hands.length!==2||!body.parent)return;
  const frame=computerFrame(time,activity.kind==='stream'),scale=activity.handScale??1;
  body.updateWorldMatrix(true,true);
  for(const [i,side,hand]of [[0,'L',1],[1,'R',0]]as const){
   const weight=frame.enter*(side==='L'?1-frame.greet:1);if(weight<=0)continue;
   p.fromArray(activity.hands[hand]);
   if(side==='R'&&activity.mouseHand)p.lerp(new T.Vector3().fromArray(activity.mouseHand),frame.mouse);
   // Activity coordinates are legacy .7-scale units, relative to the seat.
   p.y+=.06;p.z-=.10;
   if(side==='R'&&frame.mouse>.5){p.x+=Math.sin(time*1.3)*.008*frame.mouse;p.z+=Math.sin(time*1.7)*.007*frame.mouse;}
   p.multiplyScalar(scale);body.parent.localToWorld(p);goals[i].matrixWorld.makeTranslation(p.x,p.y,p.z);
   solver.updateOne(chains[i],weight);
   // Rest palms on the inputs, fingers forward; preserve a soft wrist transition.
   body.parent.getWorldQuaternion(q);q.multiply(new T.Quaternion().setFromAxisAngle(axis,side==='L'?-Math.PI/2:Math.PI/2));
   rig.bones[side+'_hand'].parent!.getWorldQuaternion(parentQ);
   rig.bones[side+'_hand'].quaternion.slerp(parentQ.invert().multiply(q),weight*.75);
   rig.setHandCurl(side,.16+.10*(side==='R'&&frame.mouse>.5?.25:Math.max(0,Math.sin(time*8+i*1.6)))*frame.enter);
   for(const [name,bone]of Object.entries(rig.bones))pose[name].copy(bone.quaternion);
   constrainForearmTwist(rig,pose,side);for(const suffix of ['twist1','twist2','twist3'])rig.bones[side+'_'+suffix]?.quaternion.copy(pose[side+'_'+suffix]);
   body.updateWorldMatrix(true,true);
  }
 };
}
