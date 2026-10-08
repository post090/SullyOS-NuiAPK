import * as T from 'three';
import type {bindBlankBody} from './blankRig';
import type {ChibiVisitor} from './visitor';
import {contactSolver} from './socialContact';
import {BLANK_SCALE} from './blankBody';
import {BLANK_FINGERS} from './blankFingers';
import {furniturePalm} from './furnitureMotion';

export const BED_LEISURE=[['bed-talk','躺着说话'],['bed-phone','躺着玩手机'],['bed-side','侧躺']] as const;
export type BedLeisure=typeof BED_LEISURE[number][0];
export const isBedLeisure=(value:unknown):value is BedLeisure=>BED_LEISURE.some(([id])=>id===value);

/** Applied over the final bed clip, in body axes, so rotated beds keep their support. */
export function createBedLeisure(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const solve=contactSolver({rig,root:body} as ChibiVisitor)!;
 const q=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
 return (time:number,mode:BedLeisure,weight=1)=>{
  const enter=T.MathUtils.smootherstep(time,0,1.2)*weight,b=rig.bones;
  const blend=(name:string,rotation:T.Quaternion)=>b[name].quaternion.slerp(rotation,enter);
  if(mode==='bed-side'){
   // Roll around the supported hips, with staggered knees and hands in front.
   b.hips.quaternion.multiply(q(0,1.25*enter,0));
   blend('L_thigh',q(-.32,0,-.035));blend('L_shin',q(.62));
   blend('R_thigh',q(-.48,0,.035));blend('R_shin',q(.83));
   blend('head',q(.02,-.10,.05));
  }else if(mode==='bed-talk'){
   blend('head',q(.015+Math.sin(time*2.6)*.026,-.15+Math.sin(time*.65)*.035));
   blend('neck',q(.02,-.05));
  }else{blend('head',q(.10));blend('neck',q(.05));}
  body.updateWorldMatrix(true,true);
  const chest=b.chest,world=chest.getWorldQuaternion(new T.Quaternion());
  const point=(x:number,y:number,z:number)=>chest.localToWorld(new T.Vector3(x,y,z).multiplyScalar(BLANK_SCALE));
  const dir=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyQuaternion(world);
  const contact=(side:'L'|'R',p:T.Vector3,d:T.Vector3,n:T.Vector3,curl:number)=>solve({side,point:p,direction:d,normal:n,curl},enter);
  if(mode==='bed-phone'){
   // Left palm supports the phone. Only the right index reaches and taps.
   const screen=dir(0,.8,-.6),normal=screen.clone().negate();
   contact('L',point(.055,-.015,.25),dir(0,.6,.8),normal,.40);
   const tap=(Math.max(0,time-1.2)%2.4),touch=Math.sin(Math.min(1,tap/.75)*Math.PI);
   const palm=point(-.055,-.07,.25),direction=dir(.8,.36,.48);
   contact('R',palm,direction,screen,.50);
   for(const name of ['R_index','R_index_tip'])b[name].quaternion.slerp(q(0,0,.035+touch*.07),enter);
   const finger=BLANK_FINGERS.find(f=>f.name==='index')!;
   const tipLocal=new T.Vector3(...finger.tip).sub(new T.Vector3(...finger.start)).multiplyScalar(.45*BLANK_SCALE);tipLocal.x*=-1;
   const target=b.L_hand.localToWorld(furniturePalm('L')).addScaledVector(screen,.015+.035*(1-touch));
   // Position the actual extended fingertip over the screen, not the wrist.
   for(let i=0;i<2;i++){
    const tip=b.R_index_tip.localToWorld(tipLocal.clone());
    palm.copy(b.R_hand.localToWorld(furniturePalm('R'))).add(target.clone().sub(tip));
    solve({side:'R',point:palm,direction,normal:screen},enter);
   }
  }else if(mode==='bed-side'){
   contact('L',point(.12,.09,.17),dir(0,1,0),dir(0,0,1),.22);
   contact('R',point(-.04,-.12,.19),dir(.6,-.8,0),dir(0,0,1),.25);
  }else{
   const gesture=Math.sin(time*1.4)*.012;
   contact('L',point(.12,-.17,.12),dir(0,-1,0),dir(0,0,-1),.20);
   contact('R',point(-.16,-.08+gesture,.16+gesture),dir(-.35,.85,0),dir(0,0,1),.18);
  }
 };
}
