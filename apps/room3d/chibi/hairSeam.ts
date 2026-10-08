import * as T from 'three';

/** Side filler with outward triangle winding on both mirrored halves. */
export function createHairSeam(side:-1|1,headDepth:number){
 const geometry=new T.PlaneGeometry(1,1,36,80);
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const theta=Math.PI/2+(uv.getX(i)-.5)*1.12,y=.78+uv.getY(i)*1.42;
  const crown=Math.sqrt(Math.max(0,1-Math.max(0,(y-1.25)/.95)**2));
  p.setXYZ(i,side*.984*crown*Math.sin(theta),y,.854*headDepth*crown*Math.cos(theta));
 }
 const original=geometry.index!,indices:number[]=[];
 for(let i=0;i<original.count;i+=3){
  const ids=[original.getX(i),original.getX(i+1),original.getX(i+2)];
  const y=ids.reduce((sum,k)=>sum+p.getY(k),0)/3,z=ids.reduce((sum,k)=>sum+p.getZ(k),0)/3;
  if(((y-1.045)/.175)**2+(z/(.205*headDepth))**2<1)continue;
  // Mirroring x reverses handedness. Without reversing winding, DoubleSide
  // treats this as a back face and flips the deliberately outward normals.
  indices.push(ids[0],ids[side<0?2:1],ids[side<0?1:2]);
 }
 geometry.setIndex(indices);
 return geometry;
}
