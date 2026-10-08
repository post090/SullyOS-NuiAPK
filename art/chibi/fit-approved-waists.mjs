// Fit the existing seven waist openings against the CURRENT wardrobe body.
// Only POSITION/NORMAL bytes in the local waist band are changed. UVs, indices,
// materials, texture payloads, skin weights, other meshes and lower silhouettes
// are retained. Backups are immutable; --force replays them for authoring QA.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {splitParts,compactGeometry} from '../jellyfish-home/asset-geometry.mjs';

const directory='output/clothing-rebuild-0920/waist-fit',backup=directory+'/before';await fs.mkdir(backup,{recursive:true});
const version='current-body-waist-v1',force=process.argv.includes('--force'),center=.045,margin=.023;
const definitions=[
 {id:'sailor-shorts',prefix:'Sailor_pants',opening:[2.473986864089966,2.4900026321411133],waist:2.4834507161920722,asset:'sailor-school-user.glb',files:['output/cardigan-controller/sailor-school-user.glb','output/sailor-school/user-painted-v1/sailor-painted-pants.glb','output/sailor-school/user-painted-v1/sailor-painted-outfit.glb','output/sailor-school/sailor-school-pants.glb']},
 {id:'sailor-skirt',prefix:'Sailor_skirt',opening:[2.487844705581665,2.489993095397949],waist:2.489225813320705,asset:'sailor-girl.glb',outerOnly:true,files:['output/cardigan-controller/sailor-girl.glb','output/sailor-girl/sailor-girl-skirt.glb']},
 {id:'lower-long-skirt',prefix:'Lowerwear_',opening:[2.5723280906677246,2.5787734985351562],waist:2.5773770093917845,seam:2.479945421218872,asset:'long-skirt-rig.glb',belt:true,files:['output/cardigan-controller/lowerwear/long-skirt-rig.glb','output/cardigan-controller/lowerwear/long-skirt-only.glb']},
 {id:'lower-straight',prefix:'Lowerwear_',opening:[2.490000009536743,2.490000009536743],waist:2.490000009536743,asset:'straight-rig.glb',files:['output/cardigan-controller/lowerwear/straight-rig.glb','output/cardigan-controller/lowerwear/straight-only.glb']},
 {id:'lower-cargo',prefix:'Lowerwear_',opening:[2.472238779067993,2.4902563095092773],waist:2.483027034335666,asset:'cargo-rig.glb',files:['output/cardigan-controller/lowerwear/cargo-rig.glb','output/cardigan-controller/lowerwear/cargo-only.glb']},
 {id:'lower-cropped',prefix:'Lowerwear_',opening:[2.467656135559082,2.4912891387939453],waist:2.481764300664266,asset:'cropped-rig.glb',files:['output/cardigan-controller/lowerwear/cropped-rig.glb','output/cardigan-controller/lowerwear/cropped-only.glb']},
 {id:'lower-shorts',prefix:'Lowerwear_',opening:[2.4458680152893066,2.4458680152893066],waist:2.4458680152893066,asset:'shorts-rig.glb',files:['output/cardigan-controller/shoes/shorts-rig.glb','output/cardigan-controller/shoes/shorts-only.glb']},
];
function parse(bytes){const length=bytes.readUInt32LE(12);return {j:JSON.parse(bytes.subarray(20,20+length)),bin:Buffer.from(bytes.subarray(28+length))};}
function accessor(a,id){const d=a.j.accessors[id],v=a.j.bufferViews[d.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[d.type],size={5121:1,5123:2,5125:4,5126:4}[d.componentType],start=(v.byteOffset??0)+(d.byteOffset??0),stride=v.byteStride??n*size;return{d,start,stride,n,size,read:i=>Array.from({length:n},(_,k)=>{const o=start+i*stride+k*size;return d.componentType===5126?a.bin.readFloatLE(o):d.componentType===5125?a.bin.readUInt32LE(o):d.componentType===5123?a.bin.readUInt16LE(o):a.bin.readUInt8(o);}),write:(i,p)=>p.forEach((x,k)=>a.bin.writeFloatLE(x,start+i*stride+k*size))};}
function geometry(a,prim){const p=accessor(a,prim.attributes.POSITION),ix=accessor(a,prim.indices),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:p.d.count},(_,i)=>p.read(i)).flat(),3));g.setIndex(Array.from({length:ix.d.count},(_,i)=>ix.read(i)[0]));return mergeVertices(g,1e-5);}
function primitives(a,def){return a.j.nodes.filter(n=>n.name?.startsWith(def.prefix)&&n.mesh!==undefined).flatMap(n=>a.j.meshes[n.mesh].primitives.flatMap((p,i)=>def.outerOnly&&i>0?[]:[p]));}
function mesh(g){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.updateMatrixWorld();return m;}
const reference=parse(await fs.readFile('output/clothing-rebuild-0920/wardrobe-current-body.glb')),bodyNode=reference.j.nodes.find(n=>n.name==='Mesh_0'),bodyFull=geometry(reference,reference.j.meshes[bodyNode.mesh].primitives[0]),bp=bodyFull.attributes.position,bodyIndices=[];
for(let i=0;i<bodyFull.index.count;i+=3){const tri=[0,1,2].map(k=>bodyFull.index.getX(i+k)),ys=tri.map(i=>bp.getY(i));if(Math.max(...ys)>2.15&&Math.min(...ys)<2.68)bodyIndices.push(...tri);}
const body=mesh(await compactGeometry(bodyFull,bodyIndices)),ray=new T.Raycaster();
function radius(object,y,a){ray.set(new T.Vector3(0,y,center),new T.Vector3(Math.cos(a),0,Math.sin(a)));ray.far=1.5;return ray.intersectObject(object)[0]?.distance;}
async function profile(asset,def){
 const gs=[];for(const prim of primitives(asset,def)){const g=geometry(asset,prim),parts=splitParts(g);gs.push(await compactGeometry(g,parts.slice(0,def.belt?2:1).flatMap(p=>p.ids)));}
 // Read the real opening loop, not a ray slightly below an uneven rim. The
 // latter samples a wider belt section and can over-contract its highest edge.
 const rim=[];for(const g of gs){const edges=new Map(),p=g.attributes.position;for(let i=0;i<g.index.count;i+=3)for(let k=0;k<3;k++){const a=g.index.getX(i+k),b=g.index.getX(i+(k+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(',');edges.set(key,(edges.get(key)??0)+1);}const graph=new Map();for(const[key,count]of edges)if(count===1){const[a,b]=key.split(',').map(Number);for(const[x,y]of[[a,b],[b,a]]){if(!graph.has(x))graph.set(x,[]);graph.get(x).push(y);}}const seen=new Set();for(const start of graph.keys()){if(seen.has(start))continue;const queue=[start];seen.add(start);for(const v of queue)for(const n of graph.get(v))if(!seen.has(n)){seen.add(n);queue.push(n);}const points=queue.map(i=>new T.Vector3().fromBufferAttribute(p,i)),ys=points.map(p=>p.y),xs=points.map(p=>p.x);if(queue.length>=12&&Math.min(...ys)>=def.opening[0]-.0005&&Math.max(...ys)<=def.opening[1]+.0005&&Math.min(...xs)<-.2&&Math.max(...xs)>.2)for(const v of points){const a=(Math.atan2(v.z-center,v.x)+Math.PI*2)%(Math.PI*2);rim.push([a,Math.hypot(v.x,v.z-center),v.y]);}}}
 rim.sort((a,b)=>a[0]-b[0]);assert(rim.length>=12,`${def.id}: opening loop missing`);
 function rimRadius(angle){const a=(angle+Math.PI*2)%(Math.PI*2);let k=rim.findIndex(v=>v[0]>=a);if(k<0)k=0;const hi=[...rim[k]],lo=[...rim[(k-1+rim.length)%rim.length]];if(k===0){if(a>lo[0])hi[0]+=Math.PI*2;else lo[0]-=Math.PI*2;}return T.MathUtils.lerp(lo[1],hi[1],(a-lo[0])/(hi[0]-lo[0]));}
 const surfaces=gs.map(mesh),low=def.waist-.205,high=def.opening[1]+.027,rows=40,columns=128,values=[];
 for(let row=0;row<=rows;row++){const y=low+(high-low)*row/rows,rs=[],bs=[];for(let k=0;k<columns;k++){const a=k*Math.PI*2/columns;let sourceRadius;
   for(const testY of [y,Math.min(y,def.opening[0]-.0003),Math.min(y,def.opening[0]-.005)]){const hits=surfaces.map(m=>radius(m,testY,a)).filter(Number.isFinite);if(hits.length){sourceRadius=Math.min(...hits);break;}}
   const bodyRadius=radius(body,y,a);assert(Number.isFinite(bodyRadius),`${def.id}: body radius unavailable at ${y}/${a}`);const top=T.MathUtils.smoothstep(y,def.waist-.055,def.waist-.018);if(Number.isFinite(sourceRadius))sourceRadius=T.MathUtils.lerp(sourceRadius,rimRadius(a),top);rs.push(sourceRadius);bs.push(bodyRadius);
  }
  for(let k=0;k<columns;k++)if(!Number.isFinite(rs[k])){let found=false;for(let d=1;d<columns/2;d++){const l=rs[(k-d+columns)%columns],r=rs[(k+d)%columns];if(Number.isFinite(l)&&Number.isFinite(r)){rs[k]=(l+r)/2;found=true;break;}}assert(found,`${def.id}: open profile missing`);}
  values.push(rs.map((r,k)=>bs[k]+margin-r));
 }
 function delta(y,a){const row=T.MathUtils.clamp((y-low)/(high-low)*rows,0,rows),r=Math.min(rows-1,Math.floor(row)),u=row-r,column=((a%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*columns,c=Math.floor(column),v=column-c;return T.MathUtils.lerp(T.MathUtils.lerp(values[r][c],values[r][(c+1)%columns],v),T.MathUtils.lerp(values[r+1][c],values[r+1][(c+1)%columns],v),u);}
 // A sparse rim's straight edges can cut through a convex abdomen even when
 // every rim vertex has clearance. Keep topology intact and add only the
 // local outward allowance needed for the chords, shared by nearby details.
 const guards=rim.map(()=>0);
 function guard(angle){const a=(angle+Math.PI*2)%(Math.PI*2);let k=rim.findIndex(v=>v[0]>=a);if(k<0)k=0;const hi=rim[k][0]+(k===0&&a>rim.at(-1)[0]?Math.PI*2:0),lo=rim[(k-1+rim.length)%rim.length][0]-(k===0&&a<=rim.at(-1)[0]?Math.PI*2:0);return T.MathUtils.lerp(guards[(k-1+rim.length)%rim.length],guards[k],(a-lo)/(hi-lo));}
 function deform(x,y,z){const fade=T.MathUtils.smoothstep(y,def.waist-.20,def.waist-.12);if(!fade)return[x,y,z];const r=Math.hypot(x,z-center);if(r<.001)return[x,y,z];const a=Math.atan2(z-center,x),dr=delta(y,a)*fade+guard(a)*T.MathUtils.smoothstep(y,def.waist-.12,def.waist-.025),scale=(r+dr)/r;return[x*scale,y,center+(z-center)*scale];}
 for(let pass=0;pass<4;pass++){const extra=rim.map(()=>0);for(let k=0;k<rim.length;k++){const j=(k+1)%rim.length,points=[k,j].map(i=>{const[a,r,y]=rim[i];return new T.Vector3(...deform(r*Math.cos(a),y,center+r*Math.sin(a)));});for(const t of [.125,.25,.375,.5,.625,.75,.875]){const p=points[0].clone().lerp(points[1],t),a=Math.atan2(p.z-center,p.x),r=Math.hypot(p.x,p.z-center),need=.009-(r-radius(body,p.y,a));if(need>0){extra[k]=Math.max(extra[k],need*1.12);extra[j]=Math.max(extra[j],need*1.12);}}}extra.forEach((v,k)=>guards[k]+=v);}
 return {deform,low,high,chordAllowance:Math.max(...guards)};
}
function serialize({j,bin}){const text=Buffer.from(JSON.stringify(j)),length=Math.ceil(text.length/4)*4,out=Buffer.alloc(28+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+length);text.copy(out,20);out.writeUInt32LE(bin.length,20+length);out.writeUInt32LE(0x004e4942,24+length);bin.copy(out,28+length);return out;}
async function original(file){const saved=path.join(backup,file.replaceAll('\\','/')),current=await fs.readFile(file);await fs.mkdir(path.dirname(saved),{recursive:true});try{await fs.access(saved);}catch{await fs.writeFile(saved,current);}return parse(force?await fs.readFile(saved):current);}
const reports=[];
for(const def of definitions){
 const canonical=await original(def.files[0]),already=canonical.j.asset.extras?.sullyCurrentWaist?.[def.id]===version;
 if(already&&!force){console.log(def.id,'already fitted');continue;}
 const fit=await profile(canonical,def),report={id:def.id,waist:def.waist,openingRange:def.opening,skirtToBeltSeam:def.seam,margin,localChordAllowance:fit.chordAllowance,fadeStart:def.waist-.20,files:[]};
 for(const file of [...def.files,'public/room3d/wardrobe/'+def.asset]){
  let asset;try{asset=await original(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}const prims=primitives(asset,def);assert(prims.length,`${file}: missing requested garment`);const changedAccessors=new Set(),before=Buffer.from(asset.bin),allowed=new Set();let changed=0,maxMove=0;
  for(const prim of prims){const pid=prim.attributes.POSITION;if(changedAccessors.has(pid))continue;changedAccessors.add(pid);const p=accessor(asset,pid),n=accessor(asset,prim.attributes.NORMAL),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<p.d.count;i++){const a=p.read(i),b=fit.deform(...a),distance=Math.hypot(...b.map((v,k)=>v-a[k]));if(distance>1e-7){changed++;maxMove=Math.max(maxMove,distance);p.write(i,b);for(let k=0;k<12;k++)allowed.add(p.start+i*p.stride+k);
     const columns=[0,1,2].map(k=>{const a0=[...a],a1=[...a];a0[k]-=.0002;a1[k]+=.0002;const b0=fit.deform(...a0),b1=fit.deform(...a1);return b1.map((v,j)=>(v-b0[j])/.0004);});const matrix=new T.Matrix3().set(...[0,1,2].flatMap(row=>columns.map(col=>col[row]))).invert().transpose(),normal=new T.Vector3(...n.read(i)).applyMatrix3(matrix).normalize();assert(normal.toArray().every(Number.isFinite)&&normal.length()>.99);n.write(i,normal.toArray());for(let k=0;k<12;k++)allowed.add(n.start+i*n.stride+k);
    }b.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
   }p.d.min=min;p.d.max=max;
  }
  for(let i=0;i<asset.bin.length;i++)if(asset.bin[i]!==before[i])assert(allowed.has(i),`${file}: changed unrelated byte ${i}`);
  asset.j.asset.extras={...asset.j.asset.extras,sullyCurrentWaist:{...asset.j.asset.extras?.sullyCurrentWaist,[def.id]:version}};await fs.writeFile(file,serialize(asset));report.files.push({file,changedVertices:changed,maxMove});
 }
 reports.push(report);console.log(def.id,report.waist,report.files[0]);
}
if(reports.length)await fs.writeFile(directory+'/report.json',JSON.stringify(reports,null,2));
