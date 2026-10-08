import * as T from 'three';
import {surfaceBinding,bindGeometry} from './clothing-details.mjs';

// A single, continuous trunk/leg pattern. Waist cross-sections come from the
// actual doll; a short straight leg section replaces the body's long uneven
// triangles so that cropped hems remain level when the hips bend.
export function swimShorts(body){
 const binding=surfaceBinding(body),bone=binding.bone,smooth=T.MathUtils.smoothstep,positions=[],skin=[],indices=[],n=32;
 const weights=list=>{const sum=list.reduce((s,[,w])=>s+w,0);return Array.from({length:4},(_,i)=>[list[i]?.[0]??0,(list[i]?.[1]??0)/sum]);};
 const add=(p,w)=>{const i=positions.length/3;positions.push(...p.toArray());skin.push(w);return i;},at=i=>new T.Vector3().fromArray(positions,i*3);
 const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d);
 for(const y of [2.34,2.27,2.17,2.055])for(let i=0;i<n;i++){
  const a=2*Math.PI*i/n,dir=new T.Vector3(Math.sin(a),0,Math.cos(a)),center=new T.Vector3(0,y,.055),outer=new T.Vector3(.470*Math.sin(a),y,.055+.365*Math.cos(a));
  const hit=binding.cast(center.clone().addScaledVector(dir,.8),dir.clone().negate(),1.6),surface=hit?.point.clone().addScaledVector(dir,.024);
  const p=y>2.10&&surface?surface:outer;
  const spine=smooth(y,2.16,2.52);add(p,weights([[bone('hips'),1-spine],[bone('spine'),spine]]));
 }
 for(let r=0;r<3;r++)for(let i=0;i<n;i++)quad(r*n+i,(r+1)*n+i,(r+1)*n+(i+1)%n,r*n+(i+1)%n);
 // Back-to-front crotch seam; both legs reference the exact same vertices.
 const seam=[];for(let j=1;j<8;j++){const t=j/8,p=new T.Vector3(0,2.055-.14*Math.sin(Math.PI*t),T.MathUtils.lerp(-.310,.420,t));seam.push(add(p,weights([[bone('hips'),1]])));}
 for(const sign of [1,-1]){
  const boundary=sign>0?Array.from({length:17},(_,i)=>3*n+i).concat(seam):Array.from({length:17},(_,i)=>3*n+(16+i)%n).concat([...seam].reverse());
  const angles=boundary.map(i=>{const p=at(i);return Math.atan2((p.z-.052)/.26,(p.x-sign*.235)/.235);});let previous=boundary;
  for(const[y,rx,rz,thigh]of [[2.005,.245,.315,.20],[1.90,.245,.305,.68],[1.835,.245,.305,.87],[1.77,.245,.305,1],[1.60,.245,.305,1]]){
   const next=angles.map(a=>{const p=new T.Vector3(sign*.235+rx*Math.cos(a),y,.052+rz*Math.sin(a));return add(p,weights([[bone('hips'),1-thigh],[bone((sign>0?'L':'R')+'_thigh'),thigh]]));});
   for(let i=0;i<previous.length;i++)quad(previous[i],next[i],next[(i+1)%previous.length],previous[(i+1)%previous.length]);previous=next;
  }
  const inner=previous.map(i=>{const p=at(i);p.x=sign*.235+(p.x-sign*.235)*.975;p.z=.052+(p.z-.052)*.975;return add(p,skin[i]);});
  for(let i=0;i<previous.length;i++)quad(previous[i],inner[i],inner[(i+1)%previous.length],previous[(i+1)%previous.length]);
 }
 const inner=[];for(let i=0;i<n;i++){const p=at(i);p.x*=.980;p.z=.055+(p.z-.055)*.980;inner.push(add(p,skin[i]));}
 for(let i=0;i<n;i++)quad(i,inner[i],inner[(i+1)%n],(i+1)%n);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);bindGeometry(geometry,(_,i)=>skin[i]);
 // Smooth normals can otherwise cancel on the thin inward folded rims.
 const p=geometry.attributes.position,norm=geometry.attributes.normal;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),cx=v.y<1.92?Math.sign(v.x)*.235:0,normal=new T.Vector3(v.x-cx,0,(v.z-.052)*1.25).normalize();norm.setXYZ(i,normal.x,normal.y,normal.z);}
 return geometry;
}
