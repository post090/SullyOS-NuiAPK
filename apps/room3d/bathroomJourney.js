import {MathUtils as M} from 'three';
import {gamingPoint} from './gaming.js';
const mix=(a,b,t)=>a.map((v,i)=>M.lerp(v,b[i],t));
const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export function bathroomEntryCandidates(item,kind){
 const x=kind==='bath-soak'?.65:0;
 return [1.35,1.6,1.9,2.2].flatMap(z=>(kind==='bath-soak'?[0,-.25,.25,-.5,-.8,-1.1]:[0,-.25,.25,-.5,.5]).map(dx=>gamingPoint(item,[x+dx,.03,z])));
}
export function createBathroomJourney(activity,front,startRotation){
 const tub=activity.kind==='bath-soak',seated=activity.posture==='seated';
 return {front:[...front],startRotation,edge:activity.edge,position:[...activity.position],rotation:activity.rotation,
  edgeRotation:activity.edgeRotation??activity.rotation,tub,seated,enter:tub?3.6:seated?1.4:1.2,hold:activity.duration||12};
}
/** Separate approach, rim sit / leg turn, and settled loop; exit reverses entry. */
export function bathroomJourneyFrame(j,time){
 const duration=j.enter*2+j.hold,t=M.clamp(time,0,duration),phase=t<j.enter?'enter':t<j.enter+j.hold?'work':'exit';
 const p=phase==='enter'?t:phase==='work'?j.enter:duration-t;
 let position,rotation,seatWeight=0,legLift=0;
 if(j.tub){
  const sit=M.smootherstep(p,0,1.2),swing=M.smootherstep(p,1.2,2.5),lower=M.smootherstep(p,2.5,3.6);
  position=mix(mix(j.front,j.edge,sit),j.position,lower);
  rotation=turn(turn(j.startRotation,j.edgeRotation,sit),j.rotation,swing);
  seatWeight=sit;legLift=M.smootherstep(p,1.2,1.9);
 }else{
  const f=M.smootherstep(p,0,j.enter);position=mix(j.front,j.position,f);rotation=turn(j.startRotation,j.rotation,f);seatWeight=j.seated?f:0;
 }
 return {position,rotation,seatWeight,legLift,phase,time:phase==='work'?t-j.enter:p,done:t>=duration};
}
