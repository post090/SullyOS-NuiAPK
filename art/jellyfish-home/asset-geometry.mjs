import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};
export async function readGeometry(path){
 const bytes=await fs.readFile(path),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),binAt=20+bytes.readUInt32LE(12),bin=bytes.subarray(binAt+8,binAt+8+bytes.readUInt32LE(binAt));
 json.images=[];json.textures=[];json.materials=[{name:'unpainted',pbrMetallicRoughness:{baseColorFactor:[.8,.8,.8,1],metallicFactor:0,roughnessFactor:1}}];
 for(const mesh of json.meshes)for(const p of mesh.primitives){p.material=0;for(const key of Object.keys(p.attributes))if(!['POSITION','NORMAL'].includes(key))delete p.attributes[key];}
 const encoded=Buffer.from(JSON.stringify(json)),length=Math.ceil(encoded.length/4)*4,output=Buffer.alloc(28+length+bin.length);output.writeUInt32LE(0x46546c67,0);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(length,12);output.writeUInt32LE(0x4e4f534a,16);output.fill(32,20,20+length);encoded.copy(output,20);output.writeUInt32LE(bin.length,20+length);output.writeUInt32LE(0x004e4942,24+length);bin.copy(output,28+length);
 const {scene}=await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');scene.updateMatrixWorld(true);
 const meshes=[];scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.deleteAttribute('normal');meshes.push(mergeVertices(g,1e-5));}});return meshes;
}
export function splitParts(geometry){
 const p=geometry.attributes.position,index=geometry.index,parents=Int32Array.from({length:p.count},(_,i)=>i);
 const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 for(let i=0;i<index.count;i+=3){const a=find(index.getX(i));parents[find(index.getX(i+1))]=a;parents[find(index.getX(i+2))]=a;}
 const buckets=new Map();for(let i=0;i<index.count;i+=3){const id=find(index.getX(i));if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(index.getX(i),index.getX(i+1),index.getX(i+2));}
 return [...buckets].map(([id,ids])=>{const box=new T.Box3();for(const i of ids)box.expandByPoint(new T.Vector3().fromBufferAttribute(p,i));return {id,ids,box,center:box.getCenter(new T.Vector3()),count:ids.length/3};}).sort((a,b)=>b.count-a.count);
}
export async function compactGeometry(geometry,ids,target=Infinity){
 await MeshoptSimplifier.ready;let index=new Uint32Array(ids);if(ids.length/3>target){[index]=MeshoptSimplifier.simplify(index,geometry.attributes.position.array,3,Math.floor(target)*3,.004);}
 const positions=[],indices=[],remap=new Map(),p=geometry.attributes.position;for(const i of index){if(!remap.has(i)){remap.set(i,positions.length/3);positions.push(p.getX(i),p.getY(i),p.getZ(i));}indices.push(remap.get(i));}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setIndex(indices);result.computeVertexNormals();return result;
}
export async function saveGlb(root,path){const binary=await new GLTFExporter().parseAsync(root,{binary:true});await fs.writeFile(path,Buffer.from(binary));return binary.byteLength;}
