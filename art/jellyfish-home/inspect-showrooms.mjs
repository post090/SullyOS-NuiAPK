import fs from 'node:fs/promises';import * as T from 'three';import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';import {readGeometry,splitParts,compactGeometry,saveGlb} from './asset-geometry.mjs';
await fs.mkdir('output/showrooms',{recursive:true});
for(let i=1;i<=6;i++){
 const g=mergeGeometries(await readGeometry('output/showroom-source/'+i+'.glb')),parts=splitParts(g);g.computeBoundingBox();
 const report={i,triangles:g.index.count/3,bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],parts:parts.map(p=>({id:p.id,count:p.count,min:p.box.min.toArray(),max:p.box.max.toArray(),center:p.center.toArray()}))};
 await fs.writeFile('output/showrooms/parts-'+i+'.json',JSON.stringify(report,null,2));
 const root=new T.Group();root.add(new T.Mesh(await compactGeometry(g,Array.from(g.index.array),50000),new T.MeshStandardMaterial({color:'#c4bfb8'})));await saveGlb(root,'output/showrooms/preview-'+i+'.glb');
 console.log(i,report.triangles,parts.length,parts.slice(0,10).map(p=>p.count),report.bounds);
}
