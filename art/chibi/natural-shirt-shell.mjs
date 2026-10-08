import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const unit=map=>{const a=[...map].filter(([,w])=>w>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=a.reduce((s,[,w])=>s+w,0);return Array.from({length:4},(_,i)=>[a[i]?.[0]??0,(a[i]?.[1]??0)/sum]);};
// A thin shell of the CURRENT doll. Shared vertices and interpolated body
// weights preserve its shoulder position instead of manufacturing a sleeve
// cap above the shoulder. Only the distal sleeve flares into an A silhouette.
export function naturalShirtShell(body,{end=1.56,tee=false,template=null}={}){
 const g=template??body.geometry,p=g.attributes.position,n=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const vertex=i=>({p:new T.Vector3().fromBufferAttribute(p,i),n:new T.Vector3().fromBufferAttribute(n,i),w:Array.from({length:4},(_,k)=>[si.getComponent(i,k),sw.getComponent(i,k)])});
 const mix=(a,b,t)=>{const w=new Map();for(const[j,v]of a.w)w.set(j,(w.get(j)??0)+v*(1-t));for(const[j,v]of b.w)w.set(j,(w.get(j)??0)+v*t);return{p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),w:unit(w)};};
 const positions=[],normals=[],joints=[],weights=[];
 for(let i=0;i<g.index.count;i+=3){let poly=[0,1,2].map(k=>vertex(g.index.getX(i+k)));
  for(const distance of [v=>v.p.y-2.25,v=>template?1:3.405-v.p.y,v=>end-v.p.x,v=>end+v.p.x]){const next=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(mix(a,b,da/(da-db)));}poly=next;if(poly.length<3)break;}
  for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]]){positions.push(...v.p.toArray());normals.push(...v.n.toArray());for(const[j,w]of v.w){joints.push(j);weights.push(w);}}
 }
 const raw=new T.BufferGeometry();raw.setAttribute('position',new T.Float32BufferAttribute(positions,3));raw.setAttribute('normal',new T.Float32BufferAttribute(normals,3));raw.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));raw.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 // Source normals have splits at body patch borders. Weld before offsetting
 // so those different normals cannot pull a shared seam into a crack.
 raw.deleteAttribute('normal');const shell=mergeVertices(raw,1e-5);
 // A horizontal neck cut also catches isolated pieces of the large chin.
 // Keep only the connected torso/sleeves, never those floating head slices.
 const parent=Int32Array.from({length:shell.attributes.position.count},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<shell.index.count;i+=3){const a=find(shell.index.getX(i));parent[find(shell.index.getX(i+1))]=a;parent[find(shell.index.getX(i+2))]=a;}
 const parts=new Map();for(let i=0;i<shell.index.count;i+=3){const k=find(shell.index.getX(i));if(!parts.has(k))parts.set(k,[]);parts.get(k).push(shell.index.getX(i),shell.index.getX(i+1),shell.index.getX(i+2));}shell.setIndex([...parts.values()].sort((a,b)=>b.length-a.length)[0]);
 shell.computeVertexNormals();const sp=shell.attributes.position,sn=shell.attributes.normal;
 for(let i=0;i<sp.count;i++){
  const q=new T.Vector3().fromBufferAttribute(sp,i),normal=new T.Vector3().fromBufferAttribute(sn,i),ax=Math.abs(q.x),oldY=q.y;
  q.addScaledVector(normal,template?0:.025);
  // Straight body ease below the armhole, avoiding a sculpted waist.
  if(oldY<3.12&&ax<.45){const t=1-T.MathUtils.smoothstep(oldY,2.82,3.12),rx=.43,rz=.355,cz=.055,r=Math.hypot(q.x/rx,(q.z-cz)/rz);if(r<1){const f=T.MathUtils.lerp(1,1/r,t);q.x*=f;q.z=cz+(q.z-cz)*f;}}
  if(ax>.30&&oldY>2.90){const t=T.MathUtils.smoothstep(ax,.30,end),arm=T.MathUtils.smoothstep(ax,.30,.43)*T.MathUtils.smoothstep(oldY,2.90,2.98),dy=q.y-3.125,dz=q.z-.03,r=Math.hypot(dy,dz),target=.208+(tee?.008:.042)*t;const f=T.MathUtils.lerp(1,target/r,arm);q.y=3.125+dy*f;q.z=.03+dz*f;}
  // Preserve the exact clipped openings while moving their circumference.
  if(Math.abs(ax-end)<1e-5)q.x=Math.sign(q.x)*end;
  if(Math.abs(oldY-2.25)<1e-5)q.y=2.25;
  if(Math.abs(oldY-3.405)<1e-5)q.y=3.405;
  if(tee&&!template&&oldY>3.32){const t=T.MathUtils.smoothstep(oldY,3.32,3.405),a=Math.atan2(q.z-.03,q.x),r=.26-.075*t;q.x=T.MathUtils.lerp(q.x,r*Math.cos(a),t);q.z=T.MathUtils.lerp(q.z,.03+r*Math.sin(a),t);q.y-=.04*t*Math.max(0,Math.sin(a));}
  sp.setXYZ(i,q.x,q.y,q.z);
 }
 // The body's stitched axilla has near-coincident corners in reverse order
 // along its arm ring. Collapse only those tiny local folds; leave the
 // shoulder crown, sleeve outline, cuffs and neckline untouched.
 const remap=Int32Array.from({length:sp.count},(_,i)=>i),used=new Set(shell.index.array),local=[];
 const remappedFaces=()=>{const out=[],faces=new Map();for(let i=0;i<shell.index.count;i+=3){const a=remap[shell.index.getX(i)],b=remap[shell.index.getX(i+1)],c=remap[shell.index.getX(i+2)];if(a===b||a===c||b===c)continue;const sorted=[a,b,c].sort((a,b)=>a-b),key=sorted.join(':'),sign=((a<b&&b<c)||(b<c&&c<a)||(c<a&&a<b))?1:-1,face=faces.get(key)??{sorted,winding:0};face.winding+=sign;faces.set(key,face);}for(const{sorted:[a,b,c],winding}of faces.values())if(winding)out.push(a,winding>0?b:c,winding>0?c:b);return out;};
 const manifold=index=>{const edges=new Map();for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){const a=index[i+k],b=index[i+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`,count=(edges.get(key)??0)+1;if(count>2)return false;edges.set(key,count);}return true;};
 for(const i of used)if(Math.abs(sp.getX(i))>.31&&Math.abs(sp.getX(i))<.66&&sp.getY(i)>2.88&&sp.getY(i)<3.17)local.push(i);
 const clusters=[];
 for(const i of local){const q=new T.Vector3().fromBufferAttribute(sp,i);let cluster=clusters.find(c=>c.every(j=>Math.abs(q.x-sp.getX(j))<.025&&q.distanceTo(new T.Vector3().fromBufferAttribute(sp,j))<.050));if(!cluster){cluster=[];clusters.push(cluster);}cluster.push(i);}
 for(const c of clusters)if(c.length>1){const id=c[0];for(const j of c)remap[j]=id;if(!manifold(remappedFaces())){for(const j of c)remap[j]=j;continue;}const q=new T.Vector3(),w=new Map();for(const j of c){q.add(new T.Vector3().fromBufferAttribute(sp,j));for(let k=0;k<4;k++){const b=shell.attributes.skinIndex.getComponent(j,k),v=shell.attributes.skinWeight.getComponent(j,k);w.set(b,(w.get(b)??0)+v);}}q.multiplyScalar(1/c.length);sp.setXYZ(id,q.x,q.y,q.z);for(const[k,[b,v]]of unit(w).entries()){shell.attributes.skinIndex.setComponent(id,k,b);shell.attributes.skinWeight.setComponent(id,k,v);}}
 let cleaned=remappedFaces();
 // A three-face fan whose centre has folded past its boundary adds a hidden
 // reversed triangle. Replace that fan by the same three boundary corners.
 // This changes only internal triangulation, not the surrounding silhouette.
 for(let pass=0;pass<20;pass++){const incident=new Map();for(let i=0;i<cleaned.length;i+=3)for(const v of cleaned.slice(i,i+3)){if(!incident.has(v))incident.set(v,[]);incident.get(v).push(i);}let removed=false;
  for(const id of local){const fan=incident.get(id);if(fan?.length!==3)continue;const edges=fan.map(i=>{const tri=cleaned.slice(i,i+3),k=tri.indexOf(id);return[tri[(k+1)%3],tri[(k+2)%3]];}),a=edges[0][0],b=edges[0][1],e=edges.find(([u])=>u===b),c=e?.[1];if(c===undefined||!edges.some(([u,v])=>u===c&&v===a))continue;
   const point=i=>new T.Vector3().fromBufferAttribute(sp,i),cross=t=>point(t[1]).sub(point(t[0])).cross(point(t[2]).sub(point(t[0]))),area=cross([a,b,c]);if(area.lengthSq()<1e-12)continue;const normal=area.normalize();if(!fan.some(i=>cross(cleaned.slice(i,i+3)).normalize().dot(normal)<-.1))continue;
   cleaned=cleaned.filter((_,i)=>!fan.includes(i-i%3));cleaned.push(a,b,c);removed=true;break;
  }if(!removed)break;
 }shell.setIndex(cleaned);
 shell.computeVertexNormals();
 // The visible open edge has a narrow inward turn, not a thick tube wall.
 const idx=shell.index,edges=new Map();for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){const a=idx.getX(i+k),b=idx.getX(i+(k+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 if(template)for(const[key,[a,b]]of edges)if(![a,b].every(i=>Math.abs(Math.abs(sp.getX(i))-end)<.001||Math.abs(sp.getY(i)-2.25)<.001))edges.delete(key);
 const allPos=Array.from(sp.array),allNormal=Array.from(shell.attributes.normal.array),allSI=Array.from(shell.attributes.skinIndex.array),allSW=Array.from(shell.attributes.skinWeight.array),indices=Array.from(idx.array),inner=new Map();
 for(const[a,b]of edges.values())for(const id of [a,b])if(!inner.has(id)){const q=new T.Vector3().fromBufferAttribute(sp,id),v=new T.Vector3().fromBufferAttribute(shell.attributes.normal,id);q.addScaledVector(v,-.006);inner.set(id,allPos.length/3);allPos.push(...q.toArray());allNormal.push(...v.toArray());for(let k=0;k<4;k++){allSI.push(shell.attributes.skinIndex.getComponent(id,k));allSW.push(shell.attributes.skinWeight.getComponent(id,k));}}
 for(const[a,b]of edges.values())indices.push(a,inner.get(a),b,b,inner.get(a),inner.get(b));
 if(!tee){
  // The same current-body rear-shoulder triangle turns inward in the boy
  // pose. One small facing beneath that fold covers it; no sleeve cap grows.
  // These current-body corner offsets match the separately checked blazer
  // facing, so its original skin weights and the outer shirt stay intact.
  const ids=[994,954,889],delta=[[.053628067,.014355030,.013176657],[.012242809,.017100252,.011289843],[-.029517614,.038764875,.031636163]],base=allPos.length/3;
  const points=ids.map((id,i)=>new T.Vector3().fromBufferAttribute(body.geometry.attributes.position,id).add(new T.Vector3().fromArray(delta[i]))),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  for(let i=0;i<3;i++){allPos.push(...points[i].toArray());allNormal.push(...normal.toArray());for(let k=0;k<4;k++){allSI.push(body.geometry.attributes.skinIndex.getComponent(ids[i],k));allSW.push(body.geometry.attributes.skinWeight.getComponent(ids[i],k));}}indices.push(base,base+1,base+2);
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(allPos,3));result.setAttribute('normal',new T.Float32BufferAttribute(allNormal,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(allSI,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(allSW,4));result.setIndex(indices);return result;
}
