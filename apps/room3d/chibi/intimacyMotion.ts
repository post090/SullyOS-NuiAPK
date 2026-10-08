import {poseSeatedHug} from './seatedHug';
import * as T from 'three';
import type {ChibiVisitor} from './visitor';
import type {contactSolver} from './socialContact';
import {poseHug} from './hugMotion';

type Resident={visitor:ChibiVisitor;solver:ReturnType<typeof contactSolver>};
const smooth=T.MathUtils.smootherstep;
const rotation=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
export const isPrincessCarry=(id:string)=>id==='home-princess-carry'||id==='home-princess-carried';
export const isIntimacy=(id:string)=>id==='home-hug'||isPrincessCarry(id);
/** Reference-video phases, in elapsed seconds; neither role owns a separate clock. */
export function intimacyPhase(action:string,time:number){
 const carry=isPrincessCarry(action);
 return {
  contact:smooth(time,.3,carry?1.8:2)*(1-smooth(time,7.5,9.6)),
  lift:carry?smooth(time,2,3.8)*(1-smooth(time,6.7,8.8)):0,
  crouch:carry?(smooth(time,.5,1.7)*(1-smooth(time,2,3.5))+smooth(time,6.5,7.7)*(1-smooth(time,8.2,9.5)))*.48:0,
 };
}
/** Pose only: called after idle reset; translations live under the navigation root. */
export function poseIntimacy(action:string,both:Resident[],time:number,seatedIndex?:number){
 const [a,b]=both.map(r=>r.visitor),p=intimacyPhase(action,time);
 if(!a.rig||!b.rig)return;
 if(action==='home-hug'){if(seatedIndex===0||seatedIndex===1)poseSeatedHug(both,time,seatedIndex);else poseHug(both,time);return;}
 const turn=(v:ChibiVisitor,n:string,q:T.Quaternion,w:number)=>v.rig!.bones[n].quaternion.slerp(q,w);
 const point=(v:ChibiVisitor,n:string,offset=[0,0,0])=>v.rig!.bones[n].localToWorld(new T.Vector3(...offset));
 const contact=(index:number,side:'L'|'R',target:T.Vector3,curl=.18)=>{
  const facing=both[index].visitor.root.getWorldQuaternion(new T.Quaternion());
  both[index].solver?.({side,point:target,direction:new T.Vector3(side==='L'?1:-1,0,0).applyQuaternion(facing),normal:new T.Vector3(0,1,0).applyQuaternion(facing),curl},p.contact);
 };
 const sole=()=>Math.min(...['L_toe','R_toe','L_foot','R_foot'].map(n=>point(a,n).y));
 const standingSole=sole();
 for(const side of ['L','R'] as const){
  turn(a,side+'_thigh',rotation(-p.crouch,0,(side==='L'?-.05:.05)*p.contact),1);
  turn(a,side+'_shin',rotation(p.crouch*2),1);
  turn(a,side+'_foot',rotation(-p.crouch),1);
 }
 a.root.updateWorldMatrix(true,true);a.translatePose(new T.Vector3(0,standingSole-sole(),0));
 // The recipient turns across the carrier, folds both knees, then rises into the arms.
 turn(b,'hips',rotation(0,Math.PI/2,0).multiply(rotation(-.45)),p.lift);
 for(const side of ['L','R'] as const){
  turn(b,side+'_thigh',rotation(-1.35,0,side==='L'?-.025:.025),p.lift);
  turn(b,side+'_shin',rotation(1.45),p.lift);
  turn(b,side+'_foot',rotation(.12),p.lift);
 }
 b.root.updateWorldMatrix(true,true);
 const target=point(a,'hips',[.25,.58,.86]);
 b.translatePose(target.sub(point(b,'hips')).multiplyScalar(p.lift));
 for(const side of ['L','R'] as const){
  turn(a,side+'_upperArm',rotation(-.15,side==='L'?-.6:.6,side==='L'?-.8:.8),p.contact);
  turn(b,side+'_upperArm',rotation(-.2,side==='L'?-.6:.6,side==='L'?-.6:.6),p.contact);
 }
 a.root.updateWorldMatrix(true,true);b.root.updateWorldMatrix(true,true);
 contact(0,'L',point(b,'spine',[0,.10,-.16]),.3);
 contact(0,'R',point(b,'R_shin',[0,.08,-.10]),.3);
 contact(1,'L',point(a,'R_upperArm',[0,.07,-.10]));
 contact(1,'R',point(a,'L_upperArm',[0,.02,-.12]));
}
