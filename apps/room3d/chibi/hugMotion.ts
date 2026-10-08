import * as T from 'three';
import type {ChibiVisitor} from './visitor';
import type {contactSolver} from './socialContact';
import {hugHandContact,poseHugFingers} from './hugHands';

type Resident={visitor:ChibiVisitor;solver:ReturnType<typeof contactSolver>};
const smooth=T.MathUtils.smootherstep;
const rotation=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
const pulse=(t:number,start:number)=>smooth(t,start,start+.24)*(1-smooth(t,start+.24,start+.46));

/** A small response delay, then two unhurried pats and one answering pat. */
export function hugPhase(time:number,role:number,side:'L'|'R'='R'){
 const delay=role===0?0:.22,t=time-delay;
 return {
  arms:smooth(t,.08,1.18)*(1-smooth(t,8.65,9.75)),
  reach:smooth(t,.65,1.65)*(1-smooth(t,8.45,9.55)),
  wrap:smooth(t,1.15,2.75)*(1-smooth(t,7.5,8.7)),
  settle:smooth(time,1.4,3.1)*(1-smooth(time,7.65,9)),
  pat:role===0&&side==='R'?pulse(time,3.85)+pulse(time,4.95):role===1&&side==='L'?pulse(time,6.05):0,
 };
}

/** Always start from the frame's idle pose, so pause/seek never accumulates IK. */
export function poseHug(both:Resident[],time:number,seatedIndex?:number){
 const point=(v:ChibiVisitor,n:string,offset:number[])=>v.rig!.bones[n].localToWorld(new T.Vector3(...offset));
 const turn=(v:ChibiVisitor,n:string,q:T.Quaternion,w:number)=>v.rig!.bones[n].quaternion.slerp(q,w);
 const axis=both[0].visitor.root.getWorldQuaternion(new T.Quaternion());
 // Finish both torsos before solving either pair of hands.
 both.forEach(({visitor:v},i)=>{
  const p=hugPhase(time,i),answer=hugPhase(time,1-i,i===0?'L':'R').pat;
  const breathe=Math.sin((time-3.1)*2.1)*.008*smooth(time,3.1,3.8)*(1-smooth(time,7.2,7.65));
  turn(v,'spine',rotation((seatedIndex!==undefined&&i!==seatedIndex)? .18 : .025,0,-.025),p.settle);
  turn(v,'chest',rotation(.06+breathe+answer*.012,0,-.075),p.settle);
  turn(v,'head',rotation(.10, i===0?-.08:.08,-.13),p.settle);
  if(i!==seatedIndex)v.translatePose(new T.Vector3((i===0?1:-1)*.18,0,(i===0?1:-1)*.12).applyQuaternion(axis).multiplyScalar(p.settle));
 });
 both.forEach(({visitor:v,solver},i)=>{
  const partner=both[1-i].visitor,ownerQ=v.root.getWorldQuaternion(new T.Quaternion());
  const backQ=partner.rig!.bones.chest.getWorldQuaternion(new T.Quaternion());
  for(const side of ['L','R'] as const){
   const sign=side==='L'?1:-1,p=hugPhase(time,i,side);
   // Raise and open elbows first; the recipient answers slightly later.
   turn(v,side+'_clavicle',rotation(0,0,sign*.04),p.arms);
   turn(v,side+'_upperArm',rotation(-.12,-sign*.55,-sign*(.85-.22*p.wrap)),p.arms);
   turn(v,side+'_forearm',rotation(0,-sign*.42,-sign*.24),p.arms);
   v.root.updateWorldMatrix(true,true);
   const ready=point(v,'chest',[sign*.86,-.18,.40]);
   const back=point(partner,'chest',[-sign*.30,i===0?-.14:-.30,-.36]);
   // Travel around the flank, not straight through the torso. Reverse this arc
   // while releasing, before lowering the arms beside the body.
   const target=ready.lerp(back,p.wrap).add(new T.Vector3(sign*.27,.07,0).applyQuaternion(ownerQ).multiplyScalar(Math.sin(Math.PI*p.wrap)));
   target.add(new T.Vector3(0,.04,-.24).applyQuaternion(backQ).multiplyScalar(p.pat));
   const {direction,normal}=hugHandContact(side,i,p.wrap,p.pat,ownerQ,backQ);
   solver?.({side,point:target,direction,normal},p.reach);
   poseHugFingers(v.rig!,side,time,i,p.arms,p.wrap,p.pat);
   v.root.updateWorldMatrix(true,true);
  }
 });
}
