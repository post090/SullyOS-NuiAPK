import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {saveGlb} from './asset-geometry.mjs';
// Idempotent, only width changes. Keep seat height, depth, materials and topology.
export async function widenDiningBench(){
 const file='public/room3d/show_kitchen_bench.glb',bytes=await fs.readFile(file);
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const bounds=new T.Box3().setFromObject(scene),width=bounds.getSize(new T.Vector3()).x;
 scene.scale.x*=2.8/width;await saveGlb(scene,file);
 const path='public/room3d/catalog.json',catalog=JSON.parse(await fs.readFile(path,'utf8')),a=catalog.find(a=>a.id==='show_kitchen_bench');
 a.size[0]=2.8;a.boxes[0][0]=-1.4;a.boxes[0][3]=1.4;a.revision='showrooms-dining-two-1';
 a.seats=[-.85,.85].map((x,i)=>({id:String(i),label:i?'右边':'左边',position:[x,.55,0],rotation:0}));
 await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
}
await widenDiningBench();
