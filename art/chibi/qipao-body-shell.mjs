import * as T from 'three';

// The upper garment is the actual doll surface, not an independently sized
// torso tube. Exact cuts preserve its shoulder topology and skin weights.
export function qipaoBodyShell(body, lowerWeights) {
 const g=body.geometry, p=g.attributes.position, n=g.attributes.normal;
 const si=g.attributes.skinIndex, sw=g.attributes.skinWeight;
 const weights=map=>{const list=[...map].filter(([,w])=>w>1e-9).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=list.reduce((a,[,w])=>a+w,0);return Array.from({length:4},(_,i)=>[list[i]?.[0]??0,(list[i]?.[1]??0)/sum]);};
 const source=Array.from({length:p.count},(_,i)=>({p:new T.Vector3().fromBufferAttribute(p,i),n:new T.Vector3().fromBufferAttribute(n,i).normalize(),w:weights(new Map(Array.from({length:4},(_,k)=>[si.getComponent(i,k),sw.getComponent(i,k)])))}));
 const interpolate=(a,b,t)=>{const map=new Map();for(const[j,w]of a.w)map.set(j,(map.get(j)??0)+w*(1-t));for(const[j,w]of b.w)map.set(j,(map.get(j)??0)+w*t);return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),w:weights(map)};};
 const clip=(poly,field)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=field(a.p),db=field(b.p);if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(interpolate(a,b,da/(da-db)));}return out;};
 const vertices=[],indices=[],lookup=new Map();
 function add(v){const key=v.p.toArray().map(x=>Math.round(x*1e6)).join(',');if(lookup.has(key))return lookup.get(key);const id=vertices.length;vertices.push(v);lookup.set(key,id);return id;}
 for(let i=0;i<g.index.count;i+=3){let polygon=[0,1,2].map(k=>source[g.index.getX(i+k)]);for(const field of [v=>v.y-2.30,v=>3.415-v.y,v=>1.55-v.x,v=>v.x+1.55])polygon=clip(polygon,field);for(let k=1;k<polygon.length-1;k++)indices.push(add(polygon[0]),add(polygon[k]),add(polygon[k+1]));}
 // Exclude the disconnected chin when its bottom crosses the neckline plane.
 const parent=vertices.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<indices.length;i+=3){const r=find(indices[i]);parent[find(indices[i+1])]=r;parent[find(indices[i+2])]=r;}
 const groups=new Map();for(let i=0;i<indices.length;i+=3){const r=find(indices[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(...indices.slice(i,i+3));}
 const kept=[...groups.values()].sort((a,b)=>b.length-a.length)[0];indices.splice(0,indices.length,...kept);
 const used=new Set(indices),edges=new Map();
 for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
 for(const i of used){const v=vertices[i],ax=Math.abs(v.p.x),t=T.MathUtils.smoothstep(ax,.31,1.55);v.p.addScaledVector(v.n,.026);if(ax>.31&&v.p.y>2.87){const direction=new T.Vector3(0,v.p.y-3.125,v.p.z-.022).normalize();v.p.addScaledVector(direction,.14*t);} }
 // Join the skirt directly to the upper shell's real waist boundary.
 function sourceY(v){return v.p.y-v.n.y*.026;}
 const angle=i=>{const v=vertices[i].p;return (Math.atan2(v.x,v.z-.055)+Math.PI*2)%(Math.PI*2);};
 const boundary=new Set();for(const e of edges.values())if(e.count===1&&Math.abs(sourceY(vertices[e.a])-2.30)<1e-5&&Math.abs(sourceY(vertices[e.b])-2.30)<1e-5){boundary.add(e.a);boundary.add(e.b);}
 const ring=[...boundary].sort((a,b)=>angle(a)-angle(b));
 if(ring.length<20)throw Error(`Missing qipao waist boundary: ${ring.length}`);
 const theta=ring.map(angle),center=.95;
 const first=theta.reduce((best,a,i)=>Math.abs(a-(center-.20))<Math.abs(theta[best]-(center-.20))?i:best,0);
 const last=theta.reduce((best,a,i)=>Math.abs(a-(center+.20))<Math.abs(theta[best]-(center+.20))?i:best,0);
 const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d);
 let previous=ring;
 for(const [level,[y,rx,rz,spread]]of [[2.02,.49,.37,.012],[1.25,.46,.30,.24],[.46,.43,.275,.46]].entries()){
  const next=theta.map(a=>{let mapped=a;if(a<=theta[first])mapped=a/theta[first]*(center-spread);else if(a>=theta[last])mapped=center+spread+(a-theta[last])/(Math.PI*2-theta[last])*(Math.PI*2-center-spread);else mapped=center;const exponent=level===0?.87:.65,shape=t=>Math.sign(t)*Math.pow(Math.abs(t),exponent),point=new T.Vector3(rx*shape(Math.sin(mapped)),y,.045+rz*shape(Math.cos(mapped))),id=vertices.length;vertices.push({p:point,n:new T.Vector3(Math.sin(mapped),0,Math.cos(mapped)),w:lowerWeights(point)});return id;});
  for(let i=0;i<ring.length;i++){if(level>0&&i>=first&&i<last)continue;quad(previous[i],next[i],next[(i+1)%ring.length],previous[(i+1)%ring.length]);}
  previous=next;
 }
 // Narrow inward-facing folds close only the actual fabric edges; the slit
 // and the wrists remain open, with no caps stretching across them.
 const allEdges=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(allEdges.has(key))allEdges.get(key).count++;else allEdges.set(key,{a,b,count:1});}
 const inner=new Map(),inside=i=>{if(!inner.has(i)){inner.set(i,vertices.length);const v=vertices[i];vertices.push({...v,p:v.p.clone().addScaledVector(v.n,-.007)});}return inner.get(i);};
 for(const {a,b,count}of allEdges.values())if(count===1)quad(b,a,inside(a),inside(b));
 const remap=new Map(),compact=[];for(let i=0;i<indices.length;i++){const id=indices[i];if(!remap.has(id)){remap.set(id,compact.length);compact.push(vertices[id]);}indices[i]=remap.get(id);}vertices.splice(0,vertices.length,...compact);
 const position=[],joints=[],weight=[];for(const v of vertices){position.push(...v.p.toArray());for(const[j,w]of v.w){joints.push(j);weight.push(w);}}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(position,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(weight,4));result.setIndex(indices);result.computeVertexNormals();
 const normal=result.attributes.normal;for(let i=0;i<vertices.length;i++){const v=vertices[i];if(v.p.y>2.40&&Math.abs(v.p.x)<.36)normal.setXYZ(i,v.n.x,v.n.y,v.n.z);}
 // Cuff colour is another strip of the same surface, not a detached tube.
 const cuffIndices=[];for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3);if(ids.every(id=>Math.abs(vertices[id].p.x)>1.40))cuffIndices.push(...ids);}
 const cuff=result.clone();cuff.setIndex(cuffIndices);const cp=cuff.attributes.position;for(let i=0;i<cp.count;i++){const v=vertices[i];cp.setXYZ(i,v.p.x+v.n.x*.003,v.p.y+v.n.y*.003,v.p.z+v.n.z*.003);}cuff.computeVertexNormals();
 return {shell:result,cuffs:cuff};
}
