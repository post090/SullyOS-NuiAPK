import * as T from 'three';
import {BLANK_FINGERS,type HandSide} from './blankFingers';
import type {bindBlankBody} from './blankRig';
import {furnitureHandRotation} from './furnitureMotion';

const smooth=T.MathUtils.smootherstep;
const curls={thumb:[.27,.16],index:[.24,.16],middle:[.31,.22],ring:[.38,.28],pinky:[.43,.33]} as const;
const closeSpread={thumb:.12,index:.10,middle:.035,ring:-.025,pinky:-.095};
const yAxis=new T.Vector3(0,1,0);

/** Fingers lie diagonally across the back, instead of four upright stop palms.
 * The authored digits curl towards -Y: +Y is the BACK of this hand. */
export function hugHandContact(side:HandSide,role:number,wrap:number,pat:number,owner:T.Quaternion,back:T.Quaternion){
 const sign=side==='L'?1:-1;
 const ready=furnitureHandRotation(side,new T.Vector3(sign*.7,-.5,.45).applyQuaternion(owner).toArray(),new T.Vector3(sign,0,0).applyQuaternion(owner).toArray());
 const direction=new T.Vector3(sign,role===0?.28:.12,-.10*pat).normalize().applyQuaternion(back);
 const outward=new T.Vector3(0,-.12*pat,-1).normalize().applyQuaternion(back);
 const resting=furnitureHandRotation(side,direction.toArray(),outward.toArray());
 // Roll into contact late, then let the wrist relax before the arm drops.
 ready.slerp(resting,smooth(wrap,.08,.94));
 return {direction:new T.Vector3(sign,0,0).applyQuaternion(ready),normal:new T.Vector3(0,1,0).applyQuaternion(ready)};
}

/** Each digit has a separate proximal/distal bend and a small closing spread.
 * IK has already placed the palm; only the finger rotations change here. */
export function poseHugFingers(rig:ReturnType<typeof bindBlankBody>,side:HandSide,time:number,role:number,arms:number,wrap:number,pat:number){
 const sign=side==='L'?1:-1;
 for(const [index,finger] of BLANK_FINGERS.entries()){
  const [ax,,az]=finger.start,[bx,,bz]=finger.tip;
  const axis=new T.Vector3(bz-az,0,-sign*(bx-ax)).normalize();
  const follow=smooth(time-(role*.22+index*.045),1.65,2.9)*wrap;
  // Soft cup while raising the hand, gently settle onto the back; a pat opens
  // the fingers slightly without straightening or spreading them into a fan.
  const softness=(.88+.12*follow)*(1-.40*pat);
  const [base,tip]=curls[finger.name];
  const spread=new T.Quaternion().setFromAxisAngle(yAxis,sign*closeSpread[finger.name]*(.65+.35*wrap));
  const proximal=new T.Quaternion().setFromAxisAngle(axis,base*softness).premultiply(spread);
  const distal=new T.Quaternion().setFromAxisAngle(axis,tip*softness);
  rig.bones[`${side}_${finger.name}`].quaternion.slerp(proximal,arms);
  rig.bones[`${side}_${finger.name}_tip`].quaternion.slerp(distal,arms);
 }
}
