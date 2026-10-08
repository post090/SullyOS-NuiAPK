// Use the body footprint; hair and accessories may overlap in narrow rooms.
export function withResidents(map,people,start){
 return {...map,free:(x,z)=>map.free(x,z)&&people.every(p=>Math.hypot(x-p[0],z-p[1])>=Math.min(.58,start?Math.hypot(start[0]-p[0],start[1]-p[1]):.58)-1e-6)};
}
export function residentBlocksStep(from,to,people){
 const vx=to[0]-from[0],vz=to[1]-from[1];
 return people.some(p=>{
  const startDistance=Math.hypot(from[0]-p[0],from[1]-p[1]);
  // Existing overlap (e.g. getting up beside someone) may separate, never deepen.
  if(startDistance<.56&&(from[0]-p[0])*vx+(from[1]-p[1])*vz>=0&&Math.hypot(to[0]-p[0],to[1]-p[1])>startDistance)return false;
  const t=Math.max(0,Math.min(1,((p[0]-from[0])*vx+(p[1]-from[1])*vz)/(vx*vx+vz*vz||1)));
  return Math.hypot(from[0]+t*vx-p[0],from[1]+t*vz-p[1])<.56;
 });
}
