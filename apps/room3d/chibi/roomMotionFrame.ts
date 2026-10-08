import {MathUtils} from 'three';

// Authored for body 2. Shared phases keep the prop and the skeleton in sync.
export const SEAT_CHANGE_SECONDS=1.05;
export const seatChangeDuration=(pose='chair')=>pose==='bed'?3.792+5.708333492279053:pose==='floor'?2.2:SEAT_CHANGE_SECONDS;
export function seatChangeFrame(time:number,rising=false,pose='chair'){
 const t=MathUtils.clamp(time/seatChangeDuration(pose),0,1),p=rising?1-t:t;
 if(pose==='floor'){
  const weight=MathUtils.smootherstep(p,.12,.86);
  return {weight,fold:MathUtils.smootherstep(p,.32,.96),support:MathUtils.smootherstep(p,0,.25)*(1-MathUtils.smootherstep(p,.78,1)),lean:Math.sin(p*Math.PI)*.28,done:t>=1};
 }
 return {weight:MathUtils.smootherstep(p,0,1),fold:0,support:0,lean:Math.sin(MathUtils.smootherstep(p,0,1)*Math.PI)*.22,done:t>=1};
}
export function wateringFrame(time:number){
 const t=Math.max(0,time),reach=MathUtils.smootherstep(t,0,.65)*(1-MathUtils.smootherstep(t,3.55,4.35));
 const pour=MathUtils.smootherstep(t,.8,1.25)*(1-MathUtils.smootherstep(t,3.1,3.55));
 return {reach,pour,tilt:pour*(.38+Math.sin(t*2.3)*.025)};
}
