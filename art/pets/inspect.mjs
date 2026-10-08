import fs from 'node:fs/promises';
import JSZip from 'jszip';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,saveGlb} from '../jellyfish-home/asset-geometry.mjs';
const zip=await JSZip.loadAsync(await fs.readFile(process.argv[2]));
await fs.mkdir('output/pets/raw',{recursive:true});await fs.mkdir('art/pets/sources',{recursive:true});
const report=[];let n=0;
for(const entry of Object.values(zip.files).filter(e=>e.name.endsWith('.glb'))){
 n++;const path=`output/pets/raw/${n}.glb`;await fs.writeFile(path,await entry.async('nodebuffer'));
 const g=mergeGeometries(await readGeometry(path)),parts=splitParts(g),root=new T.Group();
 g.computeVertexNormals();root.add(new T.Mesh(g,new T.MeshStandardMaterial({color:'#b9bec4',roughness:.85})));
 await saveGlb(root,`art/pets/sources/${n}.glb`);
 report.push({n,source:entry.name,triangles:g.index.count/3,parts:parts.map(p=>({id:p.id,count:p.count,min:p.box.min.toArray(),max:p.box.max.toArray()}))});
 console.log(n,g.index.count/3,parts.length,JSON.stringify(report.at(-1).parts.slice(0,20)));
}
await fs.writeFile('output/pets/source-report.json',JSON.stringify(report,null,2));
