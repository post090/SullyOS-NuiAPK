import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import type {bindBlankBody} from './blankRig';
import type {ActivityPose} from './types';
import {rhythmFrame} from '../rhythm.js';
import {constrainForearmTwist} from '../../../experiments/chibi/forearmTwist';
import {BLANK_SCALE} from './blankBody';

export function eatingLift(time:number){
 const phase=Math.max(0,time)%2.8;
 return phase<1.05?T.MathUtils.smootherstep(phase,0,1.05):1-T.MathUtils.smootherstep(phase,1.55,2.35);
}
// Both palms rotate with the wheel, using the same angle as its visual effect.
export function racingHands(hands:number[][],time:number,wheel?:ActivityPose['wheel']){
 if(wheel){const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(...wheel.axis),Math.sin(time*1.9)*.31);return [-1,1].map(sign=>new T.Vector3(sign*wheel.radius,0,0).applyQuaternion(q).add(new T.Vector3(...wheel.center)).toArray());}
 const center=hands[0].map((v,i)=>(v+hands[1][i])/2),angle=-Math.sin(time*1.9)*.31,c=Math.cos(angle),s=Math.sin(angle);
 return hands.map(p=>{const x=p[0]-center[0],y=p[1]-center[1];return [center[0]+c*x-s*y,center[1]+s*x+c*y,p[2]];});
}

// Authored palm/grip centres, relative to the hand bone; the wrist is behind contact.
export function furniturePalm(side:string,race=false){return new T.Vector3((side==='L'?1:-1)*(race?.045:.035),race?-.019:-.008,0).multiplyScalar(BLANK_SCALE);}
export function furnitureHandRotation(side:string,direction:number[],normal:number[]){
 const x=new T.Vector3(...direction).multiplyScalar(side==='L'?1:-1).normalize(),y=new T.Vector3(...normal).normalize(),z=new T.Vector3().crossVectors(x,y).normalize();
 y.crossVectors(z,x).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
}

/** Furniture goals live in the resident frame. Virtual IK targets never alter the skin or bone lengths. */
export function createFurnitureContact(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const goals=[new T.Bone(),new T.Bone()],bones=[...rig.skeleton.bones,...goals];
 const index=(name:string)=>bones.indexOf(rig.bones[name]);
 const chains=['R','L'].map((side,i)=>({target:rig.skeleton.bones.length+i,effector:index(side+'_hand'),iteration:48,maxAngle:.16,links:[{index:index(side+'_forearm')},{index:index(side+'_upperArm')}]}));
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains),p=new T.Vector3(),mouth=new T.Vector3();
 const pose=Object.fromEntries(Object.keys(rig.bones).map(name=>[name,new T.Quaternion()]));
 return (time:number,activity:ActivityPose)=>{
  if(!body.parent||activity.hands.length!==2)return;
  const scale=activity.handScale??1,beat=activity.kind==='rhythm'?rhythmFrame(activity,time):null;
  const hands=beat?.hands??(activity.kind==='race'?racingHands(activity.hands,time,activity.wheel):activity.hands);
  const enter=T.MathUtils.smootherstep(time,0,.65);
  body.updateWorldMatrix(true,true);
  for(const [i,side]of [[0,'R'],[1,'L']]as const){
   let handRotation:T.Quaternion|undefined;
   if(activity.wheel){
    const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(...activity.wheel.axis),Math.sin(time*1.9)*.31);
    // Fingers wrap outward over the rim; +Z in both authored hands is the thumb.
    // Pointing fingers inward rolls both thumbs underneath the wheel.
    handRotation=furnitureHandRotation(side,[side==='L'?1:-1,0,0],activity.wheel.axis).premultiply(turn);
   }else if(beat?.directions)handRotation=furnitureHandRotation(side,beat.directions[i],beat.normal);
   p.fromArray(hands[i]);if(beat)p.add(new T.Vector3().fromArray(beat.offset));
   p.multiplyScalar(scale);
   if(handRotation)p.sub(furniturePalm(side,!!activity.wheel).applyQuaternion(handRotation));
   body.parent.localToWorld(p);
   if(activity.kind==='eat'&&side==='L'){
    // Aim the grip outside the face, not at the head pivot inside the skull.
    // The 0.189-world-unit spoon extends back from this grip toward the lips.
    mouth.set(.08,.005,.185).multiplyScalar(BLANK_SCALE*(rig.mesh.geometry.userData.headSize??1.04));
    rig.bones.head.localToWorld(mouth);
    handRotation=furnitureHandRotation(side,[-.75,0,-.66],[0,1,0]);
    const palm=furniturePalm(side).applyQuaternion(body.parent.getWorldQuaternion(new T.Quaternion()).multiply(handRotation)).multiplyScalar(body.parent.getWorldScale(new T.Vector3()).x);
    p.lerp(mouth,eatingLift(time)).sub(palm);

   }
   goals[i].matrixWorld.makeTranslation(p.x,p.y,p.z);solver.updateOne(chains[i],enter);
   if(handRotation){
    const world=body.parent.getWorldQuaternion(new T.Quaternion()).multiply(handRotation),parent=rig.bones[side+'_hand'].parent!.getWorldQuaternion(new T.Quaternion());
    rig.bones[side+'_hand'].quaternion.slerp(parent.invert().multiply(world),enter);
   }
   rig.setHandCurl(side,activity.kind==='pet-contact'?.1:activity.kind==='rhythm'?.04:activity.kind==='hug'?.24:activity.wheel?.86:.48);
   for(const [name,bone]of Object.entries(rig.bones))pose[name].copy(bone.quaternion);
   constrainForearmTwist(rig,pose,side);for(const suffix of ['twist1','twist2','twist3'])rig.bones[side+'_'+suffix]?.quaternion.copy(pose[side+'_'+suffix]);
   body.updateWorldMatrix(true,true);
  }
 };
}
