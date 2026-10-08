// Repair leg ownership without changing the authored outer silhouette or waist.
// The cargo source additionally contains a fused centre seam below the crotch;
// split that contact and cap the hidden inner edges before assigning each leg.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as T from 'three';

const dir='output/clothing-rebuild-0920/pants-binding',version='separate-pant-legs-v1';
await fs.mkdir(dir+'/before',{recursive:true});
const force=process.argv.includes('--force'),definitions=['straight','cargo','cropped'];
function parse(b){const n=b.readUInt32LE(12);return {j:JSON.parse(b.subarray(20,20+n)),bin:Buffer.from(b.subarray(28+n))};}
function pack(a){a.j.buffers[0].byteLength=a.bin.length;const text=Buffer.from(JSON.stringify(a.j)),n=Math.ceil(text.length/4)*4,b=Buffer.alloc(28+n+a.bin.length);b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(n,12);b.writeUInt32LE(0x4e4f534a,16);b.fill(32,20,20+n);text.copy(b,20);b.writeUInt32LE(a.bin.length,20+n);b.writeUInt32LE(0x004e4942,24+n);a.bin.copy(b,28+n);return b;}
function read(a,id){const d=a.j.accessors[id],v=a.j.bufferViews[d.bufferView],size={5121:1,5123:2,5125:4,5126:4}[d.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[d.type],start=(v.byteOffset??0)+(d.byteOffset??0),stride=v.byteStride??n*size;return Array.from({length:d.count},(_,i)=>Array.from({length:n},(_,k)=>{const o=start+i*stride+k*size;return d.componentType===5126?a.bin.readFloatLE(o):d.componentType===5125?a.bin.readUInt32LE(o):d.componentType===5123?a.bin.readUInt16LE(o):a.bin.readUInt8(o);}));}
function append(a,rows,type,componentType=5126){const n=rows[0].length,size=componentType===5123?2:4,b=Buffer.alloc(Math.ceil(rows.length*n*size/4)*4);rows.forEach((row,i)=>row.forEach((x,k)=>{const at=(i*n+k)*size;if(componentType===5126)b.writeFloatLE(x,at);else if(componentType===5123)b.writeUInt16LE(x,at);else b.writeUInt32LE(x,at);}));const view=a.j.bufferViews.push({buffer:0,byteOffset:a.bin.length,byteLength:b.length})-1;a.bin=Buffer.concat([a.bin,b]);const d={bufferView:view,componentType,count:rows.length,type};if(type==='VEC3'){d.min=[0,1,2].map(k=>Math.min(...rows.map(r=>r[k])));d.max=[0,1,2].map(k=>Math.max(...rows.map(r=>r[k])));}return a.j.accessors.push(d)-1;}
function garment(a){const node=a.j.nodes.find(n=>n.name?.startsWith('Lowerwear_')&&n.mesh!==undefined);assert(node);return{node,prim:a.j.meshes[node.mesh].primitives[0]};}
async function load(file){const saved=path.join(dir,'before',file.replaceAll('\\','/'));await fs.mkdir(path.dirname(saved),{recursive:true});const current=await fs.readFile(file);try{await fs.access(saved);}catch{await fs.writeFile(saved,current);}return parse(force?await fs.readFile(saved):current);}
const current=parse(await fs.readFile('output/clothing-rebuild-0920/wardrobe-current-body.glb'));assert(current.j.skins[0].joints.length===48,'current full body must have 48 bones');
const currentSkin=current.j.skins[0],currentShin=currentSkin.joints.findIndex(i=>current.j.nodes[i].name==='L_shin'),currentScale=new T.Matrix4().fromArray(read(current,currentSkin.inverseBindMatrices)[currentShin]).invert().elements[13]/.20;
assert(Math.abs(currentScale-1.875/.354)<1e-5,'current body proportions changed; review binding ranges');
const smooth=T.MathUtils.smoothstep;
const results=[];
for(const id of definitions){
 const file=`output/cardigan-controller/lowerwear/${id}-rig.glb`,asset=await load(file);
 if(asset.j.asset.extras?.sullyPantLegs===version&&!force){console.log(id,'already repaired');continue;}
 const {node,prim}=garment(asset),attrs=Object.fromEntries(Object.entries(prim.attributes).map(([k,v])=>[k,read(asset,v)])),oldIndex=read(asset,prim.indices).flat(),bones=asset.j.skins[node.skin].joints.map(i=>asset.j.nodes[i].name),boneIds=Object.fromEntries(bones.map((n,i)=>[n,i]));
 const originalCount=attrs.POSITION.length,vertices=attrs.POSITION.map((p,i)=>({a:Object.fromEntries(Object.entries(attrs).map(([k,rows])=>[k,[...rows[i]]])),owner:0,key:'v'+i}));
 let index=[...oldIndex],addedCaps=0;
 const cutoff=1.97,plane=.0023682;
 if(id==='cargo'){
  const output=[],cache=new Map();
  function mix(a,b,t,key){const data={};for(const name of Object.keys(attrs)){if(['JOINTS_0','WEIGHTS_0'].includes(name))continue;data[name]=a.a[name].map((v,k)=>T.MathUtils.lerp(v,b.a[name][k],t));}if(data.NORMAL)data.NORMAL=new T.Vector3(...data.NORMAL).normalize().toArray();const weights=new Map();for(const[v,factor]of[[a,1-t],[b,t]])v.a.JOINTS_0.forEach((j,k)=>weights.set(j,(weights.get(j)??0)+v.a.WEIGHTS_0[k]*factor));const top=[...weights].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((s,[,w])=>s+w,0);data.JOINTS_0=Array.from({length:4},(_,i)=>top[i]?.[0]??0);data.WEIGHTS_0=Array.from({length:4},(_,i)=>(top[i]?.[1]??0)/sum);return{a:data,owner:0,key};}
  function clip(poly,distance,label,positive){const result=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a.a.POSITION)*(positive?1:-1),db=distance(b.a.POSITION)*(positive?1:-1);if(da>=-1e-10)result.push(a);if((da>1e-10&&db< -1e-10)||(da< -1e-10&&db>1e-10)){const pair=[a.key,b.key].sort(),key=label+':'+pair.join('|');if(!cache.has(key))cache.set(key,mix(a,b,da/(da-db),key));result.push(cache.get(key));}}return result;}
  function emit(poly,owner){for(let k=1;k<poly.length-1;k++)output.push([poly[0],poly[k],poly[k+1]].map(v=>({v,owner})));}
  for(let t=0;t<oldIndex.length;t+=3){const poly=[0,1,2].map(k=>vertices[oldIndex[t+k]]);if(Math.min(...poly.map(v=>v.a.POSITION[1]))>=cutoff){emit(poly,0);continue;}const upper=clip(poly,p=>p[1]-cutoff,'crotch',true),lower=clip(poly,p=>p[1]-cutoff,'crotch',false);emit(upper,0);emit(clip(lower,p=>p[0]-plane,'centre',true),1);emit(clip(lower,p=>p[0]-plane,'centre',false),-1);}
  const newVertices=[],ids=new Map();index=[];
  function add(v,owner){const onSeam=v.a.POSITION[1]<cutoff-1e-7&&Math.abs(v.a.POSITION[0]-plane)<1e-7,key=v.key+(onSeam?':'+owner:'');if(!ids.has(key)){ids.set(key,newVertices.length);newVertices.push({...v,a:Object.fromEntries(Object.entries(v.a).map(([k,a])=>[k,[...a]])),owner:v.a.POSITION[1]<cutoff-1e-7?owner:0});}return ids.get(key);}
  for(const tri of output){const ii=tri.map(({v,owner})=>add(v,owner));if(new Set(ii).size===3)index.push(...ii);}
  // Cap each projected inner seam contour. The cut touches a narrow internal
  // contact area only; cap triangles are inside the original garment silhouette.
  for(const owner of [-1,1]){
   const points=new Map(),edges=new Map();const key=v=>v.a.POSITION.slice(1).map(x=>x.toFixed(7)).join(',');
   for(let t=0;t<index.length;t+=3){const vs=[0,1,2].map(k=>index[t+k]);if(!vs.some(i=>newVertices[i].owner===owner)||vs.some(i=>newVertices[i].owner===-owner))continue;for(let k=0;k<3;k++){const a=newVertices[vs[k]],b=newVertices[vs[(k+1)%3]];if(Math.abs(a.a.POSITION[0]-plane)>1e-7||Math.abs(b.a.POSITION[0]-plane)>1e-7)continue;const ka=key(a),kb=key(b);if(ka===kb)continue;points.set(ka,a);points.set(kb,b);const e=[ka,kb].sort().join(';');edges.set(e,(edges.get(e)??0)+1);}}
   const graph=new Map();for(const [e,count]of edges)if(count%2){const[a,b]=e.split(';');for(const[x,y]of[[a,b],[b,a]]){if(!graph.has(x))graph.set(x,new Set());graph.get(x).add(y);}}
   const used=new Set();for(const start of [...graph.keys()].sort((a,b)=>graph.get(a).size-graph.get(b).size)){
    const links=[...graph.get(start)].filter(n=>!used.has([start,n].sort().join(';')));if(!links.length)continue;const loop=[start];let prev=null,at=start;
    while(true){const next=[...graph.get(at)].find(n=>n!==prev&&!used.has([at,n].sort().join(';')));if(!next)break;used.add([at,next].sort().join(';'));prev=at;at=next;if(at===start)break;loop.push(at);if(loop.length>1000)throw Error('bad seam loop');}
    if(loop.length<3)continue;const polygon=loop.map(k=>new T.Vector2(points.get(k).a.POSITION[1],points.get(k).a.POSITION[2]));for(const tri of T.ShapeUtils.triangulateShape(polygon,[])){
      let vv=tri.map(i=>({...points.get(loop[i]),a:Object.fromEntries(Object.entries(points.get(loop[i]).a).map(([k,a])=>[k,[...a]])),owner,key:'cap'+newVertices.length+':'+i}));
      const a=new T.Vector3(...vv[0].a.POSITION),b=new T.Vector3(...vv[1].a.POSITION),c=new T.Vector3(...vv[2].a.POSITION);const cross=b.sub(a).cross(c.sub(a));if(cross.lengthSq()<1e-16)continue;if(cross.x*owner>0)vv=[vv[0],vv[2],vv[1]];for(const v of vv){v.a.NORMAL=[-owner,0,0];index.push(newVertices.length);newVertices.push(v);}addedCaps++;
    }
   }
  }
  vertices.splice(0,vertices.length,...newVertices);
 }else{
  // Connected components below the crotch own a leg, even if a folded inner
  // vertex crosses x=0; vertex-sign or nearest-point ownership is insufficient.
  const graph=Array.from({length:vertices.length},()=>new Set());for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){const a=index[t+k],b=index[t+(k+1)%3];if(vertices[a].a.POSITION[1]<cutoff&&vertices[b].a.POSITION[1]<cutoff){graph[a].add(b);graph[b].add(a);}}
  const seen=new Set();for(let start=0;start<vertices.length;start++){if(seen.has(start)||vertices[start].a.POSITION[1]>=cutoff)continue;const q=[start];seen.add(start);for(const i of q)for(const n of graph[i])if(!seen.has(n)){seen.add(n);q.push(n);}const mean=q.reduce((s,i)=>s+vertices[i].a.POSITION[0],0)/q.length,owner=mean>=0?1:-1;for(const i of q)vertices[i].owner=owner;}
 }
 let changedWeights=0;
 for(const v of vertices){const [x,y,z]=v.a.POSITION;if(y>=cutoff)continue;const owner=v.owner||(x>=plane?1:-1),prefix=owner===1?'L':'R';
  const previous=new Map();v.a.JOINTS_0.forEach((j,k)=>{let name=bones[j];if(/^[LR]_(thigh|shin|foot|toe)$/.test(name))name=prefix+name.slice(1);previous.set(name,(previous.get(name)??0)+v.a.WEIGHTS_0[k]);});
  // Uniform longitudinal weights remove the nearest-vertex angular variations
  // around each cuff; knee/ankle thresholds match the current wardrobe body.
  const yy=y/currentScale-.5,leg=1-smooth(yy,-.20,-.105),knee=smooth(yy,-.33,-.27),ankle=1-smooth(yy,-.47,-.43);
  const clean=new Map([['hips',1-leg],[prefix+'_thigh',leg*knee],[prefix+'_shin',leg*(1-knee)*(1-ankle)],[prefix+'_foot',leg*(1-knee)*ankle]]);
  const retain=smooth(y,1.86,cutoff);for(const name of new Set([...clean.keys(),...previous.keys()]))clean.set(name,T.MathUtils.lerp(clean.get(name)??0,previous.get(name)??0,retain));
  const weights=[...clean].filter(([,w])=>w>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=weights.reduce((s,[,w])=>s+w,0),joints=Array(4).fill(0),values=Array(4).fill(0);weights.forEach(([name,w],k)=>{assert(boneIds[name]!==undefined);joints[k]=boneIds[name];values[k]=w/sum;});if(joints.some((x,k)=>x!==v.a.JOINTS_0[k])||values.some((x,k)=>Math.abs(x-v.a.WEIGHTS_0[k])>1e-7))changedWeights++;v.a.JOINTS_0=joints;v.a.WEIGHTS_0=values;
 }
 const checks={verticesBefore:originalCount,verticesAfter:vertices.length,trianglesBefore:oldIndex.length/3,trianglesAfter:index.length/3,changedWeights,addedCaps,oppositeLegInfluences:0};
 for(const v of vertices)if(v.a.POSITION[1]<1.86){const owner=v.owner||(v.a.POSITION[0]>=plane?1:-1);v.a.JOINTS_0.forEach((j,k)=>{if(v.a.WEIGHTS_0[k]>1e-6&&bones[j].startsWith(owner===1?'R_':'L_'))checks.oppositeLegInfluences++;});}
 assert.equal(checks.oppositeLegInfluences,0);
 const authored=Object.fromEntries(Object.keys(attrs).map(name=>[name,vertices.map(v=>v.a[name])]));
 function writeGeometry(a,skin){const {prim}=garment(a);for(const [name,rows]of Object.entries(authored)){if(!skin&&['JOINTS_0','WEIGHTS_0'].includes(name))continue;const old=prim.attributes[name];if(old===undefined&&!['JOINTS_0','WEIGHTS_0'].includes(name))continue;prim.attributes[name]=append(a,rows,{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[rows[0].length],name==='JOINTS_0'?5123:5126);}prim.indices=append(a,index.map(i=>[i]),'SCALAR',5125);a.j.asset.extras={...a.j.asset.extras,sullyPantLegs:version};}
 writeGeometry(asset,true);const bytes=pack(asset);await fs.writeFile(file,bytes);await fs.writeFile(`public/room3d/wardrobe/${id}-rig.glb`,bytes);
 const onlyFile=`output/cardigan-controller/lowerwear/${id}-only.glb`,only=await load(onlyFile);writeGeometry(only,false);await fs.writeFile(onlyFile,pack(only));
 const report={id,...checks,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),files:[file,onlyFile,`public/room3d/wardrobe/${id}-rig.glb`]};results.push(report);console.log(report);
}
if(results.length)await fs.writeFile(dir+'/report.json',JSON.stringify({version,currentBodyBones:48,results},null,2));
// Refresh counts even on an idempotent run, so a subsequent publish cannot
// keep the pre-separation cargo count after adding the inner seam triangles.
const manifestFile='output/cardigan-controller/lowerwear/manifest.json',manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
for(const id of definitions){const a=parse(await fs.readFile(`output/cardigan-controller/lowerwear/${id}-rig.glb`)),{prim}=garment(a),item=manifest.find(m=>m.id===id);item.triangles=a.j.accessors[prim.indices].count/3;item.bootCover={straight:.41,cargo:.60,cropped:.76}[id];}
await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2));
