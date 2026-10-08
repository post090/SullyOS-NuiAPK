import fs from 'node:fs/promises';import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import {readGeometry,compactGeometry,saveGlb} from './asset-geometry.mjs';
await MeshoptSimplifier.ready;
const path='art/jellyfish-home/sources/showrooms/curtain-window.glb';
if(process.argv.includes('--extract')){
 const g=mergeGeometries(await readGeometry('output/showroom-source/6.glb')),p=g.attributes.position,idx=g.index,ids=[];
 for(let k=0;k<idx.count;k+=3){const is=[0,1,2].map(j=>idx.getX(k+j));if(is.every(i=>p.getX(i)>=-.60&&p.getX(i)<=.50&&p.getY(i)>=-.165&&p.getY(i)<=.478&&p.getZ(i)>=-.870&&p.getZ(i)<=-.65))ids.push(...is);}
 let cut=await compactGeometry(g,ids);let [index]=MeshoptSimplifier.simplify(new Uint32Array(cut.index.array),cut.attributes.position.array,3,12000*3,.02,['Permissive']);cut=await compactGeometry(cut,index);const root=new T.Group();root.add(new T.Mesh(cut,new T.MeshStandardMaterial()));await saveGlb(root,path);
}
const source=mergeGeometries(await readGeometry(path)),positions=source.attributes.position,index=source.index,ids=[];
// Keep the actual two pleated curtain strips. The fused room wall and objects
// on its sill are outside these reviewed regions and must not follow the window.
for(let k=0;k<index.count;k+=3){const is=[0,1,2].map(j=>index.getX(k+j));if(is.every(i=>((positions.getX(i)>-.435&&positions.getX(i)<-.205)||(positions.getX(i)>.255&&positions.getX(i)<.455))&&positions.getY(i)>-.139&&positions.getY(i)<.438&&positions.getZ(i)>-.828&&positions.getZ(i)<-.747&&!(positions.getX(i)>.405&&positions.getY(i)<.01&&positions.getZ(i)>-.78)))ids.push(...is);}
const root=new T.Group(),mats={cream:new T.MeshStandardMaterial({color:'#e9e0d2',roughness:.92,side:T.DoubleSide}),woodLight:new T.MeshStandardMaterial({roughness:.8}),glass:new T.MeshStandardMaterial({color:'#c8dce0',emissive:'#fff1ce',emissiveIntensity:.15,roughness:.7})};mats.woodLight.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);for(const [n,m]of Object.entries(mats))m.name=n;
let g=await compactGeometry(source,ids);const [ix]=MeshoptSimplifier.simplify(new Uint32Array(g.index.array),g.attributes.position.array,3,Math.min(g.index.count,3000*3),.03,['Permissive']);g=await compactGeometry(g,ix);g.translate(-.005,.139,.79);g.scale(3.9,3.9,3.9);root.add(new T.Mesh(g,mats.cream));
const box=(w,h,d,x,y,z,mat)=>{const g=new T.BoxGeometry(w,h,d);g.deleteAttribute('uv');g.translate(x,y,z);root.add(new T.Mesh(g,mats[mat]));};
box(3.28,2.16,.018,0,1.08,-.145,'glass');for(const x of [-1.64,0,1.64])box(.055,2.2,.08,x,1.1,-.085,'woodLight');for(const y of [.025,2.175])box(3.34,.06,.09,0,y,-.085,'woodLight');box(3.48,.065,.32,0,.015,-.035,'woodLight');box(3.55,.045,.045,0,2.27,.03,'woodLight');
let b=new T.Box3().setFromObject(root),c=b.getCenter(new T.Vector3());for(const o of root.children)o.geometry.translate(-c.x,-b.min.y,-c.z);
const merged=new T.Group();for(const mat of Object.values(mats)){const gs=root.children.filter(o=>o.material===mat).map(o=>o.geometry);if(gs.length)merged.add(new T.Mesh(mergeGeometries(gs),mat));}
b=new T.Box3().setFromObject(merged);const s=b.getSize(new T.Vector3()).toArray();let triangles=0;merged.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});if(triangles>=4000)throw Error('curtain window budget '+triangles);
const bytes=await saveGlb(merged,'public/room3d/suite_window_bedroom.glb'),catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),a=catalog.find(a=>a.id==='suite_window_bedroom');Object.assign(a,{size:s,boxes:[[-s[0]/2,0,-s[2]/2,s[0]/2,s[1],s[2]/2]],revision:'curtain-source-2'});await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');const reportPath='art/jellyfish-home/sources/showrooms/decor-report.json',report=JSON.parse(await fs.readFile(reportPath,'utf8')),r=report.find(v=>v.id===a.id);Object.assign(r,{triangles,bytes});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log({triangles,bytes,size:s});
