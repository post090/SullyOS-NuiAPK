import * as T from 'three';
import type {HairLayer} from './types';

/** Keep silhouette corners within half a source pixel, without dense pixel-edge strips. */
export function simplifyLinerContours(contours:T.Vector2[][]){
 const tolerance=.5/472;
 const reduce=(points:T.Vector2[]):T.Vector2[]=>{
  if(points.length<=2)return points;
  const first=points[0],last=points[points.length-1],delta=last.clone().sub(first),length=delta.lengthSq();let far=0,index=0;
  for(let i=1;i<points.length-1;i++){const t=length?T.MathUtils.clamp(points[i].clone().sub(first).dot(delta)/length,0,1):0,d=points[i].distanceToSquared(first.clone().addScaledVector(delta,t));if(d>far){far=d;index=i;}}
  if(far<=tolerance*tolerance)return [first,last];
  return [...reduce(points.slice(0,index+1)).slice(0,-1),...reduce(points.slice(index))];
 };
 return contours.map(points=>{
  let opposite=1;for(let i=2;i<points.length;i++)if(points[i].distanceToSquared(points[0])>points[opposite].distanceToSquared(points[0]))opposite=i;
  const reduced=[...reduce(points.slice(0,opposite+1)).slice(0,-1),...reduce([...points.slice(opposite),points[0]]).slice(0,-1)];
  return reduced.length>=3?reduced:points;
 });
}

/** Original-canvas wisps on a thin sheet tucked inside the rear wrap. */
export function createRearHairLiner(settings:HairLayer,headDepth:number,surface?:T.BufferGeometry,compactCrown=false){
 const geometry=surface??new T.PlaneGeometry(1,1,32,40),p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  let x=surface?p.getX(i):(uv.getX(i)*472-237)/325*1.875,y=surface?p.getY(i):(424-(1-uv.getY(i))*472)/336*2;
  const thickness=surface?p.getZ(i):0;
  // Sink the cap's root, rather than clamping all upper vertices to one height.
  // The original upper silhouette keeps its height differences (ahoge/wisps).
  const tuck=T.MathUtils.smoothstep(y,1.62,1.96);
  const crownWisp=T.MathUtils.smoothstep(y,2.12,2.24);
  // The Sully curl is a small detail anchored at the crown, not a raised cap.
  // Compress the exposed silhouette as a whole so the hook keeps its opening.
  const sourceY=y;
  y-=.14*tuck;
  if(compactCrown){
   const detail=T.MathUtils.smoothstep(sourceY,2.23,2.28);
   y=T.MathUtils.lerp(y,2.14+(sourceY-2.14)*.65,detail);
   x*=1-.18*detail;
  }
  const crown=Math.sqrt(Math.max(0,1-Math.max(0,(Math.min(2.2,y)-1.25)/.95)**2));
  x=T.MathUtils.lerp(x,T.MathUtils.clamp(x,-.88*crown,.88*crown),tuck*(1-crownWisp));
  // Rear wrap reaches -.86 * headDepth. Stay near the head's center plane:
  // the head/outer hair occlude the sheet, leaving only silhouette wisps out.
  p.setXYZ(i,x*settings.width*(1+settings.distance),2.2+(y-2.2)*settings.length+settings.offsetY,-.2*headDepth*crown*(1+settings.distance)+thickness);
 }
 geometry.computeVertexNormals();return geometry;
}
