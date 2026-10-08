import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'three/addons/libs/meshopt_simplifier.module.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';

// User-supplied Meshy geometry. Texture/UV/color data is discarded before any
// processing; the inner-ear masks below are authored from geometry alone.
const source=process.argv[2]||'output/meshy-ears/source';
const specs=[
 ['fox','01a1021b-e96c-759d-b673-d0e2b82e2674',1.65,'#ba7948','#ead8bb'],
 ['dog','01a1021b-e9e2-706c-a9cd-504b3c2b32eb',1.72,'#98704f','#c9a394'],
 ['cat','01a10696-d164-72f2-bc12-cbdbaac0c44f',1.45,'#655e68','#c69ea5'],
 ['rabbit','01a1069d-b420-75a3-9ef1-40d598f3ace4',1.32,'#eee5dd','#d2a3ac'],
];
const bytes=await fs.readFile('public/room3d/wardrobe/original-outfit.glb');
const rig=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
rig.updateMatrixWorld(true);let base;rig.traverse(o=>{if(o.isSkinnedMesh)base??=o;});
const skeleton=base.skeleton,head=skeleton.bones.findIndex(b=>b.name==='head'),root=new T.Group();
root.add(skeleton.bones[0]);root.updateMatrixWorld(true);
const report=[],colors={};await MeshoptSimplifier.ready;
for(const [kind,folder,width,fur,inner]of specs){
 const file=path.join(source,folder,'Meshy_AI_model.glb'),raw=await fs.readFile(file),geometries=await readGeometry(file);
 if(geometries.length!==1)throw Error('Unexpected mesh layout: '+folder);
 const g=geometries[0],parts=splitParts(g);g.computeBoundingBox();
 const bounds=g.boundingBox,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=width/size.x;
 const pieces=[];let count=0;
 for(const [index,part]of parts.entries()){
  const target=kind==='fox'?(index<2?1800:150):1950;
  let [ids]=MeshoptSimplifier.simplify(new Uint32Array(part.ids),g.attributes.position.array,3,target*3,1);
  if(ids.length>target*3)[ids]=MeshoptSimplifier.simplifySloppy(ids,g.attributes.position.array,3,null,target*3,1);
  const clean=await compactGeometry(g,ids),p=clean.attributes.position,n=clean.attributes.normal;
  const pc=part.box.getCenter(new T.Vector3()),ps=part.box.getSize(new T.Vector3());
  const paint=[],furColor=new T.Color(fur),innerColor=new T.Color(inner);
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i);
   const x=(v.x-pc.x)/ps.x,y=(v.y-pc.y)/ps.y,z=(v.z-part.box.min.z)/ps.z;
   // Separate inset meshes exist on the furry fox. A soft geometry mask paints
   // the recessed front; no source texture colors are sampled.
   const u=x-Math.sign(pc.x)*y*.35,radial=(u/.34)**2+((y+.015)/.39)**2;
   let inset=(1-T.MathUtils.smoothstep(radial,.50,1.04))*T.MathUtils.smoothstep(normal.z,-.1,.45)*T.MathUtils.smoothstep(z,.18,.4);
   if(kind==='dog')inset*=1-T.MathUtils.smoothstep(y,-.02,.16);
   if(kind==='rabbit'&&ps.y<1.2)inset*=1-T.MathUtils.smoothstep(y,-.05,.12);
   if(kind==='fox'&&index>=2)inset=1;
   paint.push(...furColor.clone().lerp(innerColor,inset).toArray());
  }
  clean.setAttribute('color',new T.Float32BufferAttribute(paint,3));pieces.push(clean);count+=clean.index.count/3;
 }
 if(count>=4000)throw Error(`${kind}: ${count} triangles exceeds budget`);
 const id=kind+'-ears';
 {
  const welded=mergeGeometries(pieces);
  welded.translate(-center.x,-bounds.min.y,-center.z);welded.scale(scale,scale,scale);welded.translate(0,4.48,.02);
  if(kind==='fox'){
   // Turn each whole pinna inward around its buried root, including the inset.
   // Rigid rotation preserves the fur silhouette, thickness and triangle budget.
   const p=welded.attributes.position;
   for(let i=0;i<p.count;i++){
    const side=Math.sign(p.getX(i)),angle=side*T.MathUtils.degToRad(18),c=Math.cos(angle),s=Math.sin(angle);
    const x=p.getX(i)-side*.45,y=p.getY(i)-4.52;
    p.setXY(i,side*.43+c*x-s*y,4.52+s*x+c*y);
   }
  }
  welded.computeVertexNormals();
  const joints=[],weights=[];for(let i=0;i<welded.attributes.position.count;i++){joints.push(head,0,0,0);weights.push(1,0,0,0);}
  welded.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));welded.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const part='paint',m=new T.MeshStandardMaterial({name:id+'_'+part,color:0xffffff,vertexColors:true,roughness:1,side:T.DoubleSide});
  const mesh=new T.SkinnedMesh(welded,m);mesh.name=`Animal_${id}_${part}`;root.add(mesh);mesh.bind(skeleton,base.bindMatrix);
 }
 report.push({id,source:folder,sha256:createHash('sha256').update(raw).digest('hex'),sourceTriangles:g.index.count/3,triangles:count});
 colors[id]=[{id:'fur',label:'毛色',color:fur},{id:'inner',label:'耳内',color:inner}];
}
const dest='public/room3d/wardrobe/meshy-ears.glb';await saveGlb(root,dest);
const out=await fs.readFile(dest),json=JSON.parse(out.subarray(20,20+out.readUInt32LE(12))),revision=createHash('sha256').update(out).digest('hex').slice(0,12);
for(const [id,regions]of Object.entries(colors))for(const region of regions)region.targets=json.materials.flatMap((m,material)=>m.name===id+'_paint'?[{material,source:region.color}]:[]);
for(const file of ['art/chibi/animal-accessories.json','apps/room3d/chibi/approvedWardrobe.json']){
 const list=JSON.parse(await fs.readFile(file,'utf8'));for(const entry of list)if(colors[entry.id])Object.assign(entry,{asset:'meshy-ears.glb',revision});await fs.writeFile(file,JSON.stringify(list,null,2));
}
const colorFile='apps/room3d/chibi/wardrobeColorRegions.json';await fs.writeFile(colorFile,JSON.stringify({...JSON.parse(await fs.readFile(colorFile,'utf8')),...colors},null,2));
await fs.writeFile('art/chibi/meshy-ears-report.json',JSON.stringify({sourceArchive:'Meshy_AI_assets_20261004_111456.zip',revision,items:report},null,2));
console.log(JSON.stringify(report,null,2));
