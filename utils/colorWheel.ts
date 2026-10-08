export type WheelColor={h:number;s:number;v:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function hexToWheel(hex:string):WheelColor {
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),v=Math.max(r,g,b),d=v-Math.min(r,g,b);
 return {h:d===0?0:((v===r?(g-b)/d:v===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360,s:v?d/v:0,v};
}
export function wheelToHex({h,s,v}:WheelColor){
 h=((h%360)+360)%360;s=clamp(s);v=clamp(v);
 return '#'+[5,3,1].map(n=>{const k=(n+h/60)%6;return Math.round(255*(v-v*s*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');}).join('');
}
/** Position is relative to the disk center; radius is normalized to one. */
export function wheelAt(x:number,y:number,current:WheelColor):WheelColor {
 const distance=Math.hypot(x,y);
 return {...current,h:distance<.001?current.h:(Math.atan2(y,x)*180/Math.PI+360)%360,s:clamp(distance)};
}
