import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';
const manifest=JSON.parse(await fs.readFile('art/pets/manifest.json','utf8'));
for(const a of manifest){
 const path=`public/room3d/pets/${a.id.slice(4)}.glb`,bytes=await fs.readFile(path),{scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 scene.updateMatrixWorld(true);const buckets=new Map();
 scene.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');g.deleteAttribute('color');
  const eye=/^Eye[_ ](left|right)$/.test(o.name),key=eye?o.name.replace('_',' '):o.material.name;
  if(!buckets.has(key))buckets.set(key,{material:o.material,geometries:[]});buckets.get(key).geometries.push(g);
 });
 const root=new T.Group();root.name=a.id;
 for(const [name,{material,geometries}]of buckets){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.name=name;root.add(mesh);}
 a.bytes=await saveGlb(root,path);a.triangles=root.children.reduce((sum,o)=>sum+o.geometry.index.count/3,0);a.drawCalls=root.children.length;
 assertAsset(a,root);console.log(a.id,a.triangles,a.bytes,a.drawCalls);
}
function assertAsset(a,root){
 if(a.triangles>=4000)throw Error(a.id+' exceeds triangle budget');
 const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());
 if(Math.abs(box.min.y)>.0001)throw Error(a.id+' is not floor aligned');
 if(size.toArray().some((v,i)=>Math.abs(v-a.size[i])>.001))throw Error(a.id+' bounds differ from catalog');
}
await fs.writeFile('art/pets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
