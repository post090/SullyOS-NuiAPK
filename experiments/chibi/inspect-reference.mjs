import { readFileSync } from 'node:fs';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Box3, Vector3 } from 'three';
const data = readFileSync('experiments/chibi/reference.fbx');
const model = new FBXLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const meshes=[]; const bones=[];
model.traverse(o=>{if(o.isMesh) meshes.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,uv:!!o.geometry.attributes.uv,skinned:!!o.isSkinnedMesh,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,map:!!m.map,color:m.color?.getHexString()}))}); if(o.isBone) bones.push(o.name);});
console.log(JSON.stringify({meshes,bones,animations:model.animations.map(a=>a.name),size:new Box3().setFromObject(model).getSize(new Vector3()).toArray()}));
