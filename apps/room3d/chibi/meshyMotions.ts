import {MathUtils,Quaternion,Vector3} from 'three';
import clips from './meshyMotions.json';
export {clips as meshyMotions};
export type MeshyMotion=keyof typeof clips;
export const meshySelections=[
 ['01','sleep','睡觉'],['04','sit-alternate','坐姿替补'],['06','dress-once','穿衣后一次'],
 ['07','coffee-drink','泡咖啡 · 喝一口'],['08','wave-alternate-1','挥手替补一'],
 ['09','wave-alternate-2','挥手替补二'],['10','walk','行走'],['13','yoga','瑜伽垫 · 卷腹'],
] as const;
/** Root displacements are normalized to bind hip height; target bone lengths stay intact. */
export function createMeshySampler(id:MeshyMotion){
 const clip=clips[id],entries=Object.entries(clip.tracks),q=new Quaternion(),end=new Vector3();
 return (seconds:number,pose:Record<string,Quaternion>,root:Vector3,loop=false)=>{
  const t=loop?((seconds%clip.duration)+clip.duration)%clip.duration:MathUtils.clamp(seconds,0,clip.duration);
  let i=0;while(i<clip.times.length-2&&clip.times[i+1]<=t)i++;
  const j=Math.min(i+1,clip.times.length-1),mix=MathUtils.clamp((t-clip.times[i])/(clip.times[j]-clip.times[i]||1),0,1);
  for(const [name,values]of entries)pose[name]?.fromArray(values,i*4).normalize().slerp(q.fromArray(values,j*4).normalize(),mix);
  root.fromArray(clip.root,i*3).lerp(end.fromArray(clip.root,j*3),mix);
 };
}
