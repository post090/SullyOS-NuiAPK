// Widen only the approved short-sailor sleeve openings into an A silhouette.
// Byte-preserving GLB edit: torso/collar, UVs, textures, weights, topology,
// skirt, shoes and socks are not regenerated. Re-running is a no-op.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as T from 'three';

const directory='output/clothing-rebuild-0920/sailor-short',backup=directory+'/assets-before';
const files=['output/cardigan-controller/sailor-girl.glb','public/room3d/wardrobe/sailor-girl.glb','output/sailor-girl/sailor-girl-top.glb'];
const version='narrow-root-open-a-sleeve-v1';
await fs.mkdir(backup,{recursive:true});
function parse(bytes){const length=bytes.readUInt32LE(12);return{j:JSON.parse(bytes.subarray(20,20+length)),bin:Buffer.from(bytes.subarray(28+length))};}
function accessor(asset,id){const a=asset.j.accessors[id],v=asset.j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??n*size;return{a,start,stride,read:i=>Array.from({length:n},(_,k)=>{const o=start+i*stride+k*size;return a.componentType===5126?asset.bin.readFloatLE(o):a.componentType===5125?asset.bin.readUInt32LE(o):a.componentType===5123?asset.bin.readUInt16LE(o):asset.bin.readUInt8(o);}),write:(i,p)=>p.forEach((x,k)=>asset.bin.writeFloatLE(x,start+i*stride+k*size))};}
function serialize({j,bin}){const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,out=Buffer.alloc(28+length+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+length);json.copy(out,20);out.writeUInt32LE(bin.length,20+length);out.writeUInt32LE(0x004e4942,24+length);bin.copy(out,28+length);return out;}
async function source(file){const saved=path.join(backup,file),bytes=await fs.readFile(file);await fs.mkdir(path.dirname(saved),{recursive:true});try{await fs.access(saved);}catch{await fs.writeFile(saved,bytes);}return parse(bytes);}
await source(files[0]);
// Always derive component correspondence from the immutable pre-edit source.
const original=parse(await fs.readFile(path.join(backup,files[0]))),node=original.j.nodes.find(n=>n.name==='Sailor_top'),primitives=original.j.meshes[node.mesh].primitives;
const key=p=>p.map(x=>x.toFixed(5)).join(','),points=[],lookup=new Map(),faces=[];
for(const primitive of primitives){const p=accessor(original,primitive.attributes.POSITION),ix=accessor(original,primitive.indices),ids=[];for(let i=0;i<p.a.count;i++){const q=p.read(i),k=key(q);if(!lookup.has(k)){lookup.set(k,points.length);points.push(new T.Vector3(...q));}ids.push(lookup.get(k));}for(let i=0;i<ix.a.count;i+=3)faces.push([0,1,2].map(k=>ids[ix.read(i+k)[0]]));}
const parents=points.map((_,i)=>i),find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};for(const[a,b,c]of faces){const r=find(a);parents[find(b)]=r;parents[find(c)]=r;}
const parts=new Map();for(let i=0;i<points.length;i++){const root=find(i);if(!parts.has(root))parts.set(root,[]);parts.get(root).push(i);}
const sleeveIds=new Set();for(const ids of parts.values()){const box=new T.Box3().setFromPoints(ids.map(i=>points[i]));if((box.min.x>.22||box.max.x<-.22)&&Math.max(Math.abs(box.min.x),Math.abs(box.max.x))>.80&&box.min.y>2.87&&box.max.y<3.38)for(const i of ids)sleeveIds.add(i);}
assert(sleeveIds.size>700,'both authored short sleeves must be found');
const rings=[[.23,.235],[.34,.245],[.52,.230],[.68,.207],[.70,.201],[.72,.199],[.74,.197],[.77,.194],[.79,.192],[.81,.190]];
function oldRadius(x){for(let i=1;i<rings.length;i++)if(x<=rings[i][0]+1e-6){const[a,ra]=rings[i-1],[b,rb]=rings[i];return T.MathUtils.lerp(ra,rb,T.MathUtils.clamp((x-a)/(b-a),0,1));}return rings.at(-1)[1];}
function deform(p){const x=Math.abs(p.x);if(x<=.340001)return p.clone();const radius=Math.hypot(p.y-3.125,p.z+.0106),target=T.MathUtils.lerp(.245,.300,T.MathUtils.clamp((x-.34)/.47,0,1)),delta=target-oldRadius(x),scale=(radius+delta)/radius;return new T.Vector3(p.x,3.125+(p.y-3.125)*scale,-.0106+(p.z+.0106)*scale);}
const updated=points.map((p,i)=>sleeveIds.has(i)?deform(p):p.clone()),oldNormals=points.map(()=>new T.Vector3()),newNormals=points.map(()=>new T.Vector3());
for(const ids of faces)for(const [positions,normals]of[[points,oldNormals],[updated,newNormals]]){const[a,b,c]=ids.map(i=>positions[i]),normal=b.clone().sub(a).cross(c.clone().sub(a));for(const id of ids)normals[id].add(normal);}
const rotations=points.map((_,i)=>new T.Quaternion().setFromUnitVectors(oldNormals[i].normalize(),newNormals[i].normalize()));
const reports=[];
for(const file of files){const asset=await source(file);if(asset.j.asset.extras?.sullySailorShortSleeve===version){console.log(file,'already flared');continue;}const before=Buffer.from(asset.bin),allowed=new Set(),visited=new Set();let changed=0,maxMove=0,triangles=0,shoulderMoved=0;
 for(const n of asset.j.nodes.filter(n=>n.name==='Sailor_top'))for(const primitive of asset.j.meshes[n.mesh].primitives){const positionId=primitive.attributes.POSITION;if(visited.has(positionId))continue;visited.add(positionId);const p=accessor(asset,positionId),normal=accessor(asset,primitive.attributes.NORMAL),index=accessor(asset,primitive.indices);triangles+=index.a.count/3;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.a.count;i++){const old=p.read(i),id=lookup.get(key(old));assert(id!==undefined,`${file}: unmatched source vertex ${old}`);const q=updated[id],distance=q.distanceTo(new T.Vector3(...old));if(sleeveIds.has(id)){if(distance>1e-7){p.write(i,q.toArray());changed++;maxMove=Math.max(maxMove,distance);if(Math.abs(old[0])<=.340001)shoulderMoved++;for(let k=0;k<12;k++)allowed.add(p.start+i*p.stride+k);}const out=new T.Vector3(...normal.read(i)).applyQuaternion(rotations[id]).normalize();assert(out.toArray().every(Number.isFinite));normal.write(i,out.toArray());for(let k=0;k<12;k++)allowed.add(normal.start+i*normal.stride+k);}q.toArray().forEach((x,k)=>{min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);});}p.a.min=min;p.a.max=max;
 }
 assert(visited.size,'Sailor_top missing');assert.equal(shoulderMoved,0);for(let i=0;i<before.length;i++)if(before[i]!==asset.bin[i])assert(allowed.has(i),`${file}: non-sleeve byte changed at ${i}`);
 asset.j.asset.extras={...asset.j.asset.extras,sullySailorShortSleeve:version};await fs.writeFile(file,serialize(asset));reports.push({file,triangles,changedVertices:changed,maxMove,shoulderMoved,unrelatedBinaryBytesChanged:0});
}
if(reports.length)await fs.writeFile(directory+'/geometry-report.json',JSON.stringify({version,rootRadius:.245,oldOpeningRadius:.190,newOpeningRadius:.300,sleeveTriangles:faces.filter(f=>f.every(i=>sleeveIds.has(i))).length,reports},null,2));console.log(JSON.stringify(reports,null,2));
