import {seatChangeFrame,seatChangeDuration} from './chibi/roomMotionFrame.ts';
import {bedChangePose} from './bedMotion.js';

// The last short movement into a seat is outside ordinary walking clearance.
// Its standing endpoint must still be on free floor, facing the seat's front.
export function seatEntry(transform,map,offset=[0,0]){
 const [x,,z]=transform.position,angle=transform.rotation;
 for(let d=.45;d<=1.25;d+=.05){
  const p=[x+Math.sin(angle)*d,.18,z+Math.cos(angle)*d];
  if(map.free(p[0]+offset[0],p[2]+offset[1]))return p;
 }
 return null;
}
export function seatChangePose(change,time){
 if(change.pose==='bed')return bedChangePose(change,time);
 // Face the seat's forward direction before lowering onto it. Use the shortest
 // yaw arc so a turn across -PI/PI never spins all the way around.
 const duration=seatChangeDuration(change.pose),turnTime=Math.min(.3,duration*.3);
 const turn=Math.max(0,Math.min(1,time/turnTime)),blend=turn*turn*(3-2*turn);
 const target=change.rotation??0,start=change.startRotation??target;
 const delta=Math.atan2(Math.sin(target-start),Math.cos(target-start));
 const rotation=change.rising?target:start+delta*blend;
 const poseTime=change.rising?time:Math.max(0,time-turnTime)*duration/(duration-turnTime);
 const f=seatChangeFrame(poseTime,change.rising,change.pose);
 return {...f,rotation,position:change.front.map((v,i)=>v+(change.seat[i]-v)*(f.travel??f.weight))};
}
