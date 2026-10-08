import fs from 'node:fs/promises';
import * as T from 'three';
import {readGeometry,splitParts,compactGeometry,saveGlb} from './asset-geometry.mjs';
await fs.mkdir('output/botanical',{recursive:true});
for(const [name,path] of [['table','D:/Downloads/Meshy_AI_Daisy_Tea_Table_0915073355_texture.glb'],['plant','D:/Downloads/Meshy_AI_Low_Poly_Monstera_0915073534_texture (2).glb']]){
 const [geo]=await readGeometry(path),parts=splitParts(geo),root=new T.Group();
 for(const [i,part] of parts.entries())root.add(new T.Mesh(await compactGeometry(geo,part.ids,Math.max(30,part.count/40)),new T.MeshStandardMaterial({color:new T.Color().setHSL((i*.17)%1,.4,.65),roughness:1,side:T.DoubleSide})));
 const stats=parts.map(p=>({id:p.id,count:p.count,min:p.box.min.toArray(),max:p.box.max.toArray(),center:p.center.toArray()}));await fs.writeFile(`output/botanical/${name}-parts.json`,JSON.stringify(stats,null,2));await saveGlb(root,`output/botanical/${name}-parts.glb`);console.log(name,JSON.stringify(stats.slice(0,35)),`parts=${parts.length}`);
 // Geometry-only source: no maps, UVs or embedded image buffers survive export.
 const source=new T.Mesh(await compactGeometry(geo,Array.from(geo.index.array)),new T.MeshStandardMaterial({color:'#ffffff'}));await saveGlb(source,`output/botanical/${name}-geometry.glb`);
}
