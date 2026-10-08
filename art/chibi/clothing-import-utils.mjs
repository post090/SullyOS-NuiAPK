import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
export function sliceBands(g,heights){
 const p=g.attributes.position,idx=g.index,vertices=[];
 for(let i=0;i<idx.count;i+=3){let polygons=[[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+k)))];
  for(const y of heights){const next=[];for(const poly of polygons){if(poly.every(v=>v.y>=y)||poly.every(v=>v.y<=y)){next.push(poly);continue;}for(const sign of [-1,1]){const cut=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=sign*(a.y-y),db=sign*(b.y-y);if(da>=0)cut.push(a);if((da>=0)!==(db>=0))cut.push(a.clone().lerp(b,da/(da-db)));}if(cut.length>=3)next.push(cut);}}polygons=next;}
  for(const poly of polygons)for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])vertices.push(...v.toArray());
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(vertices,3));return mergeVertices(result,1e-5);
}
export async function reference(){
 const b=await fs.readFile('output/cardigan-controller/sailor-girl.glb'),l=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+l)),bin=b.subarray(28+l);
 j.images=[];j.textures=[];j.materials=[{pbrMetallicRoughness:{baseColorFactor:[.82,.80,.76,1],roughnessFactor:.85,metallicFactor:0}}];for(const m of j.meshes)for(const p of m.primitives)p.material=0;
 const text=Buffer.from(JSON.stringify(j)),len=Math.ceil(text.length/4)*4,bytes=Buffer.alloc(28+len+bin.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(len,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.fill(32,20,20+len);text.copy(bytes,20);bytes.writeUInt32LE(bin.length,20+len);bytes.writeUInt32LE(0x004e4942,24+len);bin.copy(bytes,28+len);
 const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
 const remove=[];scene.traverse(o=>{if(o.name.startsWith('Sailor_')&&o.parent?.name==='CurrentBody')remove.push(o);});for(const o of remove)o.removeFromParent();return scene;
}
export function openEnds(g,low,high){
 const p=g.attributes.position,idx=g.index,vertices=[];
 for(let i=0;i<idx.count;i+=3){let poly=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+k)));
  for(const distance of [v=>v.y-low,v=>high-v.y]){const next=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));}poly=next;}
  for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])vertices.push(...v.toArray());
 }const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(vertices,3));return mergeVertices(out,1e-5);
}
