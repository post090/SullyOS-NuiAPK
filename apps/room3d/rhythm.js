// One shared beat clock for rigid-body hops, hand contact and the struck keys.
// The apex targets are reviewed in gamingActivities; no limb scaling or IK stretch.
export function rhythmFrame(activity,time){
 if(activity?.rhythmStanding)return standingRhythmFrame(activity,time);
 const beats=activity?.rhythm;if(!beats?.length)return null;
 const t=Math.max(0,time),beat=beats[Math.floor(t/1.5)%beats.length],phase=t%1.5;
 const smooth=(a,b,v)=>{const x=Math.max(0,Math.min(1,(v-a)/(b-a)));return x*x*(3-2*x);};
 const lift=phase<.62?smooth(.12,.56,phase):1-smooth(.68,1.24,phase);
 const crouch=phase<.12?Math.sin(phase/.12*Math.PI)*.035:0;
 const offset=beat.offset.map(v=>v*lift);offset[1]-=crouch;
 const reach=smooth(.10,.53,phase)*(1-smooth(.75,1.25,phase));
 const hands=beat.hands.map((p,i)=>{const rest=[i? .415:-.415,.51,.10];return p.map((v,k)=>rest[k]+(v-rest[k])*reach);});
 return {offset,hands,keys:phase>=.56&&phase<=.68?beat.keys:[],phase,lift};
}

// Two staggered hands, each moving between real buttons. The body stays planted.
export function standingRhythmFrame(activity,time){
 const tracks=activity.rhythmStanding;if(!tracks?.every(t=>t.length))return null;
 const keys=[],hands=[],directions=[],normal=[0,.295520207,-.955336489];
 for(let hand=0;hand<2;hand++){
  const track=tracks[hand],clock=Math.max(0,time)/.30+hand*.5,index=Math.floor(clock),phase=clock-index;
  const from=track[index%track.length],to=track[(index+1)%track.length];
  const x=Math.max(0,Math.min(1,(phase-.18)/.70)),mix=x*x*(3-2*x),lift=Math.sin(Math.PI*mix)*.075;
  hands.push(from.point.map((v,k)=>v+(to.point[k]-v)*mix+normal[k]*lift));
  directions.push(from.direction.map((v,k)=>v+(to.direction[k]-v)*mix));
  if(phase<=.18)keys.push(from.key);else if(phase>=.88)keys.push(to.key);
 }
 return {offset:[0,0,0],hands,directions,normal,keys:time<.65?[]:keys,phase:time%.30,lift:0};
}
