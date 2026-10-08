import fs from 'node:fs/promises';
import {furniturePaintMaterials} from '../../apps/room3d/furniturePaint.js';
const read=async path=>{const b=await fs.readFile(path);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),kit=await read('public/room3d/kit.glb'),report=[];
function materials(j,node,set=new Set()){const n=j.nodes[node];if(n.mesh!==undefined)for(const p of j.meshes[n.mesh].primitives)set.add(j.materials[p.material].name);for(const c of n.children||[])materials(j,c,set);return [...set];}
for(const a of catalog.filter(a=>a.id!=='shell')){
 const names=a.url?(await read('public/room3d/'+a.url)).materials.map(m=>m.name):materials(kit,kit.nodes.findIndex(n=>n.extras?.assetId===a.id));
 a.paintMaterials=furniturePaintMaterials(a,names);if(!a.paintMaterials.length)throw Error(a.id+' has no paint surface');report.push({id:a.id,paint:a.paintMaterials,materials:names});
}
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('output/bathroom',{recursive:true});await fs.writeFile('output/bathroom/paint-report.json',JSON.stringify(report,null,2));console.log('Reviewed primary paint targets:',report.length);
