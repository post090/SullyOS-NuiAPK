import * as T from 'three';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import shoulderFacing from './blazer-shoulder-facing.mjs';

const normalized = map => {
 const a=[...map].filter(([,w])=>w>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=a.reduce((s,[,w])=>s+w,0);
 return Array.from({length:4},(_,i)=>[a[i]?.[0]??0,(a[i]?.[1]??0)/sum]);
};
function mix(a,b,t){
 const weights=new Map();for(const[j,w]of a.w)weights.set(j,(weights.get(j)??0)+w*(1-t));for(const[j,w]of b.w)weights.set(j,(weights.get(j)??0)+w*t);
 return{p:a.p.clone().lerp(b.p,t),w:normalized(weights)};
}
function clip(poly,distance){
 const out=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=-1e-8)out.push(a);if((da>=0)!==(db>=0))out.push(mix(a,b,da/(da-db)));}return out;
}
function geometry(polys){
 const pos=[],si=[],sw=[];for(const poly of polys)for(let k=1;k<poly.length-1;k++)for(const v of[poly[0],poly[k],poly[k+1]]){pos.push(...v.p.toArray());for(const[j,w]of v.w){si.push(j);sw.push(w);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));const result=mergeVertices(g,1e-5);result.computeVertexNormals();return result;
}
// Dedicated blazer pattern. The base is the current 48-bone body, so the
// shoulder follows its real surface and shares its exact weights. The sleeve
// acquires ease toward the wrist; no inflated sleeve cap or old-body offset.
export function naturalBlazerShell(body){
 const source=body.geometry,p=source.attributes.position,si=source.attributes.skinIndex,sw=source.attributes.skinWeight;
 const vertex=i=>({p:new T.Vector3().fromBufferAttribute(p,i),w:Array.from({length:4},(_,k)=>[si.getComponent(i,k),sw.getComponent(i,k)])});
 const polygons=[];
 for(let i=0;i<source.index.count;i+=3){let poly=[0,1,2].map(k=>vertex(source.index.getX(i+k)));for(const d of[v=>v.p.y-2.25,v=>3.405-v.p.y,v=>1.555-v.p.x,v=>1.555+v.p.x])poly=clip(poly,d);if(poly.length>2)polygons.push(poly);}
 const envelope=geometry(polygons),ep=envelope.attributes.position,en=envelope.attributes.normal;
 for(let i=0;i<ep.count;i++){
  const q=new T.Vector3().fromBufferAttribute(ep,i),ax=Math.abs(q.x),y=q.y;
  q.addScaledVector(new T.Vector3().fromBufferAttribute(en,i),.027);
  // The cut neck ring is a fabric edge. Fade vertical normal offset to zero
  // at its top, so interior vertices cannot rise above the clipped boundary.
  if(y>3.34&&ax<.27){
   const t=T.MathUtils.smoothstep(y,3.34,3.405)*(1-T.MathUtils.smoothstep(ax,.22,.27));
   q.y=T.MathUtils.lerp(q.y,y,t);
   const rx=T.MathUtils.lerp(.215,.145,T.MathUtils.clamp((y-3.34)/.065,0,1)),rz=T.MathUtils.lerp(.164,.133,T.MathUtils.clamp((y-3.34)/.065,0,1)),a=Math.atan2(q.x/rx,(q.z-.025)/rz);
   q.x=T.MathUtils.lerp(q.x,rx*Math.sin(a),t);q.z=T.MathUtils.lerp(q.z,.025+rz*Math.cos(a),t);
  }
  if(ax<.46&&y<3.14){const ease=1-T.MathUtils.smoothstep(y,2.88,3.14),rx=.48,rz=.37,cz=.045,r=Math.hypot(q.x/rx,(q.z-cz)/rz);if(r<1&&r>1e-7){const scale=T.MathUtils.lerp(1,1/r,ease);q.x*=scale;q.z=cz+(q.z-cz)*scale;}}
  if(ax>.37&&y>2.87){const amount=T.MathUtils.smoothstep(ax,.37,.58)*T.MathUtils.smoothstep(y,2.87,2.98),t=T.MathUtils.clamp((ax-.45)/(1.555-.45),0,1),dy=q.y-3.125,dz=q.z-.03,r=Math.hypot(dy,dz),target=.210+.040*t,f=T.MathUtils.lerp(1,Math.max(1,target/r),amount);q.y=3.125+dy*f;q.z=.03+dz*f;}
  if(Math.abs(ax-1.555)<1e-5)q.x=Math.sign(q.x)*1.555;
  // Extend a simple abdominal ring for the coat hem. Copying the pelvis all
  // the way to its crotch would create overlapping interior pleats at center.
  if(y<2.75){q.y=2.75+(q.y-2.75)*1.43;if(Math.abs(y-2.25)<1e-5)q.y=2.035;q.y+=.085*(1-T.MathUtils.smoothstep(Math.abs(q.x),.015,.14))*T.MathUtils.smoothstep(q.z,.20,.36)*(1-T.MathUtils.smoothstep(q.y,2.035,2.24));}
  if(Math.abs(y-3.405)<1e-5)q.y=3.405;
  ep.setXYZ(i,q.x,q.y,q.z);
 }
 envelope.computeVertexNormals();
 // Remove the inner V instead of replacing the deleted shirt with a painted
 // jacket patch. The back neck remains intact and the front is a real opening.
 const eSI=envelope.attributes.skinIndex,eSW=envelope.attributes.skinWeight,ev=i=>({p:new T.Vector3().fromBufferAttribute(ep,i),w:Array.from({length:4},(_,k)=>[eSI.getComponent(i,k),eSW.getComponent(i,k)])}),cut=[];
 const neckOpening=y=>T.MathUtils.lerp(.245*(y-2.76),.128,T.MathUtils.smoothstep(y,3.36,3.405));
 for(let i=0;i<envelope.index.count;i+=3){
  const poly=[0,1,2].map(k=>ev(envelope.index.getX(i+k))),maxY=Math.max(...poly.map(v=>v.p.y)),maxZ=Math.max(...poly.map(v=>v.p.z)),minX=Math.min(...poly.map(v=>v.p.x)),maxX=Math.max(...poly.map(v=>v.p.x)),width=Math.max(...poly.map(v=>neckOpening(v.p.y)));
  // Keep the original triangles outside the V. Splitting shoulder triangles
  // merely to classify the front/back would average positions AND weights;
  // their posed surface would then differ from the original body's triangle.
  if(maxY<=2.76||maxZ<=.055||minX>=width||maxX<=-width){cut.push(poly);continue;}
  const back=clip(poly,v=>.055-v.p.z),front=clip(poly,v=>v.p.z-.055);if(back.length>2)cut.push(back);for(const sign of[-1,1]){let side=clip(front,v=>sign*v.p.x);side=clip(side,v=>sign*v.p.x-neckOpening(v.p.y));if(side.length>2)cut.push(side);}
 }
 const shell=geometry(cut),sp=shell.attributes.position,sn=shell.attributes.normal,sSI=shell.attributes.skinIndex,sSW=shell.attributes.skinWeight,idx=shell.index,edges=new Map();
 for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){const a=idx.getX(i+k),b=idx.getX(i+(k+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 const pos=Array.from(sp.array),norm=Array.from(sn.array),joints=Array.from(sSI.array),weights=Array.from(sSW.array),indices=Array.from(idx.array),inner=new Map();
 for(const[a,b]of edges.values())for(const id of[a,b])if(!inner.has(id)){const q=new T.Vector3().fromBufferAttribute(sp,id),n=new T.Vector3().fromBufferAttribute(sn,id);q.addScaledVector(n,-.006);inner.set(id,pos.length/3);pos.push(...q.toArray());norm.push(...n.toArray());for(let k=0;k<4;k++){joints.push(sSI.getComponent(id,k));weights.push(sSW.getComponent(id,k));}}
 for(const[a,b]of edges.values())indices.push(a,inner.get(a),b,b,inner.get(a),inner.get(b));
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(pos,3));result.setAttribute('normal',new T.Float32BufferAttribute(norm,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));result.setIndex(indices);
 // Narrow internal shoulder facing. These are continuous cloth triangles,
 // bound to the same body corners. The doll's large rear shoulder triangles
 // turn inside-out during the strong boy twist; the inner fabric face closes
 // that fold without adding an inflated shoulder cap to the outer silhouette.
 const facing=[];
 for(const{ids,delta}of shoulderFacing){
  // Only this broad triangle changes its facing under the approved arm roll.
  // Keep the neighbouring normal shoulder surfaces single-layered.
  if(!ids.includes(994)||!ids.includes(954)||!ids.includes(889))continue;
  const poly=ids.map(vertex);for(let k=0;k<3;k++)poly[k].p.add(new T.Vector3().fromArray(delta[k]));facing.push(poly);
 }
 const innerFacing=geometry(facing);innerFacing.userData.internalShoulderFacing=true;
 return{shell:mergeGeometries([result,innerFacing],false),envelope};
}
