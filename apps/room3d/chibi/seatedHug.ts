import * as T from 'three';
import type {ChibiVisitor} from './visitor';
import type {contactSolver} from './socialContact';
import {poseHugFingers} from './hugHands';

type Resident={visitor:ChibiVisitor;solver:ReturnType<typeof contactSolver>};
const smooth=T.MathUtils.smootherstep;
const rotation=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
export function seatedHugPhase(t:number){return {
 kneel:smooth(t,.3,2.5)*(1-smooth(t,8.1,9.9)),
 embrace:smooth(t,1.3,3.1)*(1-smooth(t,7.3,8.3)),
 stroke:smooth(t,.65,2.4)*(1-smooth(t,7.9,9.0)),
};}

/** The seated pelvis stays on its seat; the other person lowers onto both knees. */
export function poseSeatedHug(both:Resident[],time:number,seatedIndex:number){
 const seated=both[seatedIndex],kneeling=both[1-seatedIndex],a=kneeling.visitor,b=seated.visitor;
 if(!a.rig||!b.rig)return;
 const f=seatedHugPhase(time),bones=a.rig.bones;
 if(!f.kneel&&!f.embrace&&!f.stroke)return;
 const point=(v:ChibiVisitor,n:string,offset:number[]=[])=>v.rig!.bones[n].localToWorld(new T.Vector3(...(offset.length?offset:[0,0,0])));
 const turn=(v:ChibiVisitor,n:string,q:T.Quaternion,w:number)=>v.rig!.bones[n].quaternion.slerp(q,w);
 const floor=Math.min(...['L_foot','R_foot','L_toe','R_toe'].map(n=>point(a,n).y));
 for(const [side,sign]of [['L',1],['R',-1]] as const){
  turn(a,side+'_thigh',rotation(-.16,0,-sign*.045),f.kneel);
  turn(a,side+'_shin',rotation(2.10),f.kneel);
  turn(a,side+'_foot',rotation(.40),f.kneel);
 }
 turn(a,'spine',rotation(.68,0,-.06),f.kneel);
 turn(a,'chest',rotation(.22,0,-.04),f.embrace);
 turn(a,'neck',rotation(-.10,.38),f.embrace);
 turn(a,'head',rotation(-.04,1.02,.10),f.embrace);
 a.root.updateWorldMatrix(true,true);
 // Blend from planted feet to knee support. Check both knees and both feet
 // so the folded lower legs cannot be pushed through the floor.
 const knee=Math.min(point(a,'L_shin').y,point(a,'R_shin').y);
 const foot=Math.min(...['L_foot','R_foot','L_toe','R_toe'].map(n=>point(a,n).y));
 const lower=Math.max(floor+.07-knee,floor-foot);
 a.translatePose(new T.Vector3(0,Math.max(lower*f.kneel,floor-foot),0));
 const seatedQ=b.root.getWorldQuaternion(new T.Quaternion());
 // Rest the side of the head against the abdomen, keeping knees on the floor.
 a.translatePose(new T.Vector3(.24,0,-.12).applyQuaternion(seatedQ).multiplyScalar(f.embrace));
 turn(b,'spine',rotation(.035),f.embrace);
 turn(b,'chest',rotation(.06),f.embrace);
 turn(b,'neck',rotation(.08),f.embrace);
 turn(b,'head',rotation(.19,-.10,-.055),f.embrace);
 both.forEach(r=>r.visitor.root.updateWorldMatrix(true,true));
 const backQ=b.rig.bones.hips.getWorldQuaternion(new T.Quaternion());
 for(const [side,sign]of [['L',1],['R',-1]] as const){
  turn(a,side+'_upperArm',rotation(-.16,-sign*.6,-sign*.8),f.embrace);
  turn(a,side+'_forearm',rotation(0,-sign*.8),f.embrace);
  a.root.updateWorldMatrix(true,true);
  kneeling.solver?.({side,point:point(b,'hips',[-sign*.55,.23,.20]),direction:new T.Vector3(0,.15,-1).applyQuaternion(backQ),normal:new T.Vector3(-sign,0,0).applyQuaternion(backQ)},f.embrace);
  poseHugFingers(a.rig,side,time,0,f.embrace,f.embrace,0);
 }
 // A slow stroke across the crown. The free hand rests outside the seated hip;
 // reaching over the large head would intersect the face and hugging sleeves.
 const headQ=bones.head.getWorldQuaternion(new T.Quaternion()),stroke=Math.sin((time-3.7)*2.1)*.075*f.stroke;
 const crown=point(a,'head',[.08,1.35,stroke]);
 seated.solver?.({side:'L',point:crown,direction:new T.Vector3(0,0,1).applyQuaternion(headQ),normal:new T.Vector3(0,1,0).applyQuaternion(headQ)},f.stroke);
 seated.solver?.({side:'R',point:point(b,'hips',[-.90,.08,-.65]),direction:new T.Vector3(0,-.35,-1).applyQuaternion(seatedQ),normal:new T.Vector3(0,1,-.35).applyQuaternion(seatedQ)},f.embrace);
 for(const [side,curl,weight]of [['L',.15,f.stroke],['R',.22,f.embrace]] as const){
  const fingers=Object.fromEntries(Object.entries(b.rig.bones).filter(([n])=>new RegExp('^'+side+'_(thumb|index|middle|ring|pinky)').test(n)).map(([n,bone])=>[n,bone.quaternion.clone()]));
  b.rig.setHandCurl(side,curl,fingers);
  for(const [n,q]of Object.entries(fingers))b.rig.bones[n].quaternion.slerp(q,weight);
 }
 both.forEach(r=>r.visitor.root.updateWorldMatrix(true,true));
}
