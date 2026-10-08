import {Matrix4,Quaternion,Vector3,type Bone} from 'three';

/** Retargeted, rotation-only walking cycles. Source/credits live with the fixture. */
export interface RoomWalkClip {sourceName:string;duration:number;times:number[];tracks:Record<string,number[]>}
export function createRoomWalkSampler(clip:RoomWalkClip){
 const samples=Object.entries(clip.tracks),q=new Quaternion();
 return (time:number,pose:Record<string,Quaternion>)=>{
  const t=((time%clip.duration)+clip.duration)%clip.duration;
  let i=0;while(i<clip.times.length-2&&clip.times[i+1]<=t)i++;
  const j=Math.min(i+1,clip.times.length-1),mix=(t-clip.times[i])/(clip.times[j]-clip.times[i]||1);
  for(const [name,values]of samples){const target=pose[name];if(target)target.fromArray(values,i*4).normalize().slerp(q.fromArray(values,j*4).normalize(),mix);}
 };
}

/** Estimate room travel from the retargeted stride, never source avatar scale. */
export function roomWalkSpeed(clip:RoomWalkClip,bones:Record<string,Bone>){
 const sample=createRoomWalkSampler(clip),pose=Object.fromEntries(Object.keys(bones).map(n=>[n,new Quaternion()]));
 const worlds=Object.fromEntries(Object.keys(bones).map(n=>[n,new Matrix4()])),unit=new Vector3(1,1,1),local=new Matrix4();
 const range={L:[Infinity,-Infinity],R:[Infinity,-Infinity]};
 for(const t of clip.times){
  sample(t,pose);
  for(const [name,bone]of Object.entries(bones)){
   local.compose(bone.position,pose[name],unit);const parent=bone.parent&&worlds[bone.parent.name];
   if(parent)worlds[name].multiplyMatrices(parent,local);else worlds[name].copy(local);
  }
  for(const side of ['L','R']as const){const z=worlds[`${side}_foot`].elements[14];range[side][0]=Math.min(range[side][0],z);range[side][1]=Math.max(range[side][1],z);}
 }
 return ((range.L[1]-range.L[0])+(range.R[1]-range.R[0]))/clip.duration;
}
