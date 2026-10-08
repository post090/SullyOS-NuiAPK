import * as T from 'three';
import type {ChibiVisitor} from './visitor';
import {BLANK_SCALE} from './blankBody';
import {furniturePalm,furnitureHandRotation} from './furnitureMotion';
import {contactSolver} from './socialContact';

// The cylinder runs across the fingers, with the thumb on the rim side.
const cupInHand=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
const offset=(side:'L'|'R')=>new T.Vector3(side==='L'?.010:-.010,-.018,.010).multiplyScalar(BLANK_SCALE);
export function waterGrip(visitors:ChibiVisitor[],cup:T.Group){
 const solvers=visitors.map(contactSolver);
 return (time:number,weight:number)=>{
  const transfer=T.MathUtils.smootherstep(time,2.04,2.48);
  const poses=visitors.slice(0,2).map((visitor,i)=>{
   const side=i===0?'L':'R',hand=visitor.rig?.bones[side+'_hand'];
   if(!hand)return null;
   const scale=hand.getWorldScale(new T.Vector3()).y;
   const palm=hand.localToWorld(furniturePalm(side));
   const x=new T.Vector3(1,0,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
   x.y=0;if(x.lengthSq()<.01)x.set(1,0,0);x.normalize();
   const axis=new T.Vector3(0,1,0),normal=new T.Vector3().crossVectors(axis,x).normalize();
   const direction=x.clone().multiplyScalar(side==='L'?1:-1);
   const rotation=furnitureHandRotation(side,direction.toArray(),normal.toArray());
   const center=palm.clone().add(offset(side).multiplyScalar(scale).applyQuaternion(rotation));
   return {visitor,side,scale,palm,center,rotation,direction,normal,axis};
  });
  if(poses.some(p=>!p))return false;
  const [giver,receiver]=poses as NonNullable<typeof poses[number]>[];
  const center=giver.center.clone().lerp(receiver.center,transfer);
  const owner=transfer<.5?giver:receiver;
  // A sip approaches the lower face with the rim, then tips about that rim.
  const sip=T.MathUtils.smootherstep(time,4.0,5.15)*(1-T.MathUtils.smootherstep(time,6.65,7.45));
  if(sip>0){
   const rig=receiver.visitor.rig!;
   const mouth=rig.bones.head.localToWorld(new T.Vector3(.035,.005,.185).multiplyScalar(BLANK_SCALE*(rig.mesh.geometry.userData.headSize??1.04)));
   const toward=mouth.clone().sub(receiver.center);toward.y=0;toward.normalize();
   receiver.axis.set(0,1,0).addScaledVector(toward,.65*sip).normalize();
   const x=new T.Vector3().crossVectors(receiver.normal,receiver.axis).normalize();
   receiver.direction.copy(x).negate();
   receiver.normal.crossVectors(receiver.axis,x).normalize();
   receiver.rotation.copy(furnitureHandRotation('R',receiver.direction.toArray(),receiver.normal.toArray()));
   center.lerp(mouth.addScaledVector(receiver.axis,-.115),sip);
  }
  for(const [i,p] of [giver,receiver].entries()){
   const grip=i===0?1-T.MathUtils.smootherstep(time,2.35,2.7):T.MathUtils.smootherstep(time,1.85,2.15);
   if(grip<=0)continue;
   const target=center.clone().sub(offset(p.side).multiplyScalar(p.scale).applyQuaternion(p.rotation));
   solvers[i]?.({side:p.side,point:target,direction:p.direction,normal:p.normal,curl:.87},weight*grip);
  }
  // Use the solved wrist so unreachable targets never detach the prop.
  const hand=owner.visitor.rig!.bones[owner.side+'_hand'];
  const position=hand.localToWorld(furniturePalm(owner.side).add(offset(owner.side)));
  const rotation=hand.getWorldQuaternion(new T.Quaternion()).multiply(cupInHand);
  cup.position.copy(cup.parent?cup.parent.worldToLocal(position):position);
  cup.quaternion.copy(rotation);
  if(cup.parent)cup.quaternion.premultiply(cup.parent.getWorldQuaternion(new T.Quaternion()).invert());
  return true;
 };
}
