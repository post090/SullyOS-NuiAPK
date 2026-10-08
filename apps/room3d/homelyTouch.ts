import {Vector3} from 'three';

export type HomelyTouchZone='head'|'cheek'|'body'|'arm';
export type HomelyTouch={zone:HomelyTouchZone;side:1|-1};
type Arm={side:1|-1;points:Vector3[]};
/** Use posed landmarks, so a seated or raised arm keeps its own hit region. */
export function classifyHomelyTouch(point:Vector3,base:Vector3,crown:Vector3,arms:Arm[]=[]):HomelyTouch {
 const axis=crown.clone().sub(base),height=axis.length();axis.normalize();
 const delta=point.clone().sub(base),along=delta.dot(axis),radial=delta.clone().addScaledVector(axis,-along).length();
 let nearest={distance:Infinity,side:1 as 1|-1};
 for(const arm of arms)for(let i=1;i<arm.points.length;i++){
  const start=arm.points[i-1],segment=arm.points[i].clone().sub(start);
  const t=Math.max(0,Math.min(1,point.clone().sub(start).dot(segment)/Math.max(.0001,segment.lengthSq())));
  const distance=point.distanceTo(start.clone().addScaledVector(segment,t));
  if(distance<nearest.distance)nearest={distance,side:arm.side};
 }
 // Wide sleeves sit outside the skeleton; broaden only the outer silhouette.
 if(nearest.distance<height*.22||(Math.abs(delta.x)>height*.35&&nearest.distance<height*.42))return {zone:'arm',side:nearest.side};
 const side:1|-1=delta.x<0?-1:1;
 if(along>height*.12&&radial<height*.8)return {zone:along>height*.72?'head':'cheek',side};
 return {zone:'body',side};
}

export const homelyTouchText:Record<HomelyTouchZone,string>={head:'唔…',cheek:'欸？',body:'嗯？',arm:'在呢。'};
/** Additive rotations only; feet and furniture contacts stay in the base pose. */
export function homelyTouchPose(seconds:number,touch:HomelyTouch,handsBusy=false,reducedMotion=false):Record<string,[number,number,number]> {
 if(seconds<=0||seconds>=.85||reducedMotion)return {};
 const t=seconds/.85,weight=Math.sin(Math.PI*t)*(1-t),bounce=Math.sin(t*Math.PI*3)*weight,s=touch.side;
 switch(touch.zone){
  case 'head':return {head:[.24*weight,0,.06*bounce],chest:[.035*weight,0,0]};
  case 'cheek':return {head:[-.05*weight,-s*.24*weight,-s*.16*weight]};
  case 'body':return {chest:[-.16*bounce,0,.05*bounce],head:[-.12*weight,0,0]};
  case 'arm':return handsBusy?{head:[0,s*.16*weight,.08*bounce]}:{head:[0,s*.12*weight,0],[s===1?'L_upperArm':'R_upperArm']:[-.12*weight,0,s*.1*weight],[s===1?'L_forearm':'R_forearm']:[-.5*weight,0,0]};
 }
}
