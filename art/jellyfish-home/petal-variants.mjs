// Rebuild both sizes from the approved texture-free source, never from AI images.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};
const bytes=await fs.readFile('art/jellyfish-home/sources/petal-sofa-solid.glb');
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);
const scale=2.49/new T.Box3().setFromObject(scene).getSize(new T.Vector3()).x;
const points=[],triangles=[],keys=new Map(),parents=[],materials=new Map();
function vertex(v){const key=v.toArray().map(x=>Math.round(x*1e5)).join(',');if(keys.has(key))return keys.get(key);const i=points.length;keys.set(key,i);points.push(v);parents.push(i);return i;}
function find(i){while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;}
scene.traverse(o=>{if(!o.isMesh)return;materials.set(o.material.name,o.material);const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,idx=o.geometry.index,normalMatrix=new T.Matrix3().getNormalMatrix(o.matrixWorld);
 for(let j=0;j<idx.count;j+=3){const ids=[0,1,2].map(k=>vertex(new T.Vector3().fromBufferAttribute(p,idx.getX(j+k)).applyMatrix4(o.matrixWorld).multiplyScalar(scale)));
  parents[find(ids[1])]=find(ids[0]);parents[find(ids[2])]=find(ids[0]);triangles.push({ids,normals:[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(n,idx.getX(j+k)).applyNormalMatrix(normalMatrix)),material:o.material.name});
 }
});
assert.equal(triangles.length,4858);
const parts=new Map();for(const triangle of triangles){const id=find(triangle.ids[0]);if(!parts.has(id))parts.set(id,[]);parts.get(id).push(triangle);}
// IDs refer to the fixed approved source's connected surfaces; fail on source changes.
const named={flower:1893,backLeft:666,backRight:827,armLeft:981,backCenter:1120,armRight:1281,baseAndRightSeat:2355,leftSeat:1633,pillow:1718,star:1887};
assert.equal(parts.size,20);for(const id of Object.values(named))assert.ok(parts.has(id));
const centers=new Map([...parts].map(([id,ts])=>[id,new T.Box3().setFromPoints(ts.flatMap(t=>t.ids.map(i=>points[i]))).getCenter(new T.Vector3())]));
for(const single of [false,true]){
 const width=single?1.92:3.7,delta=(width-2.49)/2,stretch=(1.75078125+2*delta)/1.75078125;
 const buckets=new Map([...materials.keys()].map(name=>[name,{positions:[],normals:[]} ]));
 for(const [id,ts] of parts)for(const triangle of ts){
  if(single&&([named.backLeft,named.backRight,named.pillow].includes(id)||id===named.baseAndRightSeat&&triangle.material==='pink-cushions'))continue;
  let sx=1,sy=1,sz=1,offset=new T.Vector3(),center=centers.get(id);
  if(id===named.baseAndRightSeat||id===named.leftSeat||[named.backLeft,named.backCenter,named.backRight].includes(id))sx=stretch;
  else if(id!==named.pillow)offset.x=Math.sign(center.x)*delta;
  if(single&&id===named.leftSeat){sx=1.30/.8693113193660974;offset.x=-center.x*sx;}
  if(single&&id===named.backCenter){sx=1.34/.6723498015850782;offset.x=-center.x*sx;}
  if(single&&(id===named.flower||id===named.star)){
   sx=sy=sz=id===named.flower?.62:.70;
   offset.set(id===named.flower?-.42:.40,.88,-.17).addScaledVector(center,-sx);
  }
  const bucket=buckets.get(triangle.material);
  triangle.ids.forEach((i,k)=>{const p=points[i].clone().multiply(new T.Vector3(sx,sy,sz)).add(offset),n=triangle.normals[k].clone().divide(new T.Vector3(sx,sy,sz)).normalize();bucket.positions.push(...p.toArray());bucket.normals.push(...n.toArray());});
 }
 const root=new T.Group();root.name=single?'petal-armchair':'petal-sofa-wide';let count=0;
 for(const [name,b] of buckets){if(!b.positions.length)continue;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));const welded=mergeVertices(geo,1e-5);geo.dispose();root.add(new T.Mesh(welded,materials.get(name)));count+=b.positions.length/9;}
 const bounds=new T.Box3().setFromObject(root);assert.ok(Math.abs(bounds.getSize(new T.Vector3()).x-width)<.001);
 const binary=await new GLTFExporter().parseAsync(root,{binary:true});
 const path=`public/room3d/${single?'petal-armchair':'petal-sofa'}.glb`;await fs.writeFile(path,Buffer.from(binary));
 console.log(JSON.stringify({path,triangles:count,bytes:binary.byteLength,size:bounds.getSize(new T.Vector3()).toArray()}));
}
