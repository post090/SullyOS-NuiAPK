import fs from 'node:fs/promises';
import {pleatedSkirtData} from './pleated-skirt.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';

const out='output/cardigan-controller/lowerwear';
await fs.mkdir(out,{recursive:true});
const definitions=[
 {id:'long-skirt',file:'humanoid character model',label:'腰带长裙',parts:[1,4,5],waist:.535,scaleY:4.4,color:'#6f7a8c',skirt:true},
 {id:'straight',file:'stylized human 3d model',label:'直筒长裤',parts:[0,5,6,7,8,9,10],waist:.540,scaleY:4.4,color:'#b3a08a',clip:true},
 {id:'cargo',file:'stylized humanoid 3d model',label:'口袋工装裤',parts:[2,6,7,8,9,10,11,12,13,14,15,16,17,18],waist:.539,scaleY:4.1,color:'#7b856b'},
 {id:'cropped',file:'humanoid character 3d model',label:'宽腿九分裤',parts:[1,4,5,6,7,8],waist:.550,scaleY:4.4,color:'#738995'},
];
function pack(j,bin){const text=Buffer.from(JSON.stringify(j)),len=Math.ceil(text.length/4)*4,b=Buffer.alloc(28+len+bin.length);b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(len,12);b.writeUInt32LE(0x4e4f534a,16);b.fill(32,20,20+len);text.copy(b,20);b.writeUInt32LE(bin.length,20+len);b.writeUInt32LE(0x004e4942,24+len);bin.copy(b,28+len);return b;}
async function reference(){
 const bytes=await fs.readFile('output/cardigan-controller/sailor-girl.glb'),l=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+l));
 j.images=[];j.textures=[];j.materials=[{pbrMetallicRoughness:{baseColorFactor:[.82,.80,.76,1],roughnessFactor:.85,metallicFactor:0}}];
 for(const m of j.meshes)for(const p of m.primitives)p.material=0;
 const b=pack(j,bytes.subarray(28+l));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene;
}
function clipGeometry(g){
 const p=g.attributes.position,idx=g.index,vertices=[];
 for(let i=0;i<idx.count;i+=3){let poly=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+k)));
  for(const distance of [v=>.540-v.y,v=>v.y-.058,v=>.115-v.x,v=>v.x+.115]){const next=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));}poly=next;}
  for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])vertices.push(...v.toArray());
 }const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(vertices,3));return mergeVertices(result,1e-5);
}
const smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const manifest=[];
for(const def of definitions){
 const [source]=await readGeometry('D:/Downloads/'+def.file+'.glb'),parts=splitParts(source);
 const root=await reference(),body=root.getObjectByName('Mesh_0');root.updateMatrixWorld(true);
 const toRemove=[];root.traverse(o=>{if(o.name.startsWith('Sailor_')&&o.parent?.name==='CurrentBody')toRemove.push(o);});for(const o of toRemove)o.removeFromParent();
 const bodyMat=new T.MeshStandardMaterial({color:'#e3d4c3',roughness:.86});body.material=bodyMat;
 const bodyPos=body.geometry.attributes.position,ray=new T.Raycaster();const target=new T.Mesh(body.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));target.updateMatrixWorld();
 const meshes=[];let pleats;
 for(const k of def.parts){let g=await compactGeometry(source,parts[k].ids);if(def.clip&&k===0){g=clipGeometry(g);g=await compactGeometry(g,splitParts(g)[0].ids);}
  let p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   let x=p.getX(i)*4.85,y=2.49+(p.getY(i)-def.waist)*def.scaleY,z=p.getZ(i)*4.85;
   // Keep the roomy source silhouette; only expand places that intersect the current body.
   const centerX=!def.skirt&&y<2.03?Math.sign(x)*.235:0,centerZ=.015;
   let dx=x-centerX,dz=z-centerZ,r=Math.hypot(dx,dz);
   const margin=k===def.parts[0]?.045:.075;
   if(r>.001&&y>.35){ray.set(new T.Vector3(centerX,y,centerZ),new T.Vector3(dx/r,0,dz/r));ray.far=.9;const hit=ray.intersectObject(target)[0];if(hit&&hit.distance+margin>r){const s=(hit.distance+margin)/r;x=centerX+dx*s;z=centerZ+dz*s;}}
   if(!def.skirt&&Math.abs(x)<.19&&y>2.0&&y<2.43){const back=z<.015;ray.set(new T.Vector3(x,y,back?-2:2),new T.Vector3(0,0,back?1:-1));ray.far=4;const hit=ray.intersectObject(target)[0];if(hit){const desired=hit.point.z+(back?-.055:.055),weight=smooth((.19-Math.abs(x))/.1)*smooth((y-2.0)/.12)*(1-smooth((y-2.32)/.11));z+=((back?Math.min(z,desired):Math.max(z,desired))-z)*weight;}}
   p.setXYZ(i,x,y,z);
  }
  if(def.skirt&&k===def.parts[0]){g.computeBoundingBox();pleats={count:20,rows:16,top:g.boundingBox.max.y,bottom:g.boundingBox.min.y,bones:Object.fromEntries(body.skeleton.bones.map((b,i)=>[b.name,i]))};const data=pleatedSkirtData(pleats);g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.position,3));g.setIndex(data.index);p=g.attributes.position;pleats.vertexCount=p.count;pleats.indexCount=data.index.length;}
  g.computeVertexNormals();g.computeBoundingBox();
  const joints=[],weights=[],bp=bodyPos,bi=body.geometry.attributes.skinIndex,bw=body.geometry.attributes.skinWeight;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let influences=new Map();
   if(def.skirt){
    const hip=smooth((y-2.00)/.30),shin=(1-hip)*(1-smooth((y-1.05)/.45)),thigh=1-hip-shin,left=smooth((x+.18)/.36);
    for(const [name,w]of [['hips',hip],['L_thigh',thigh*left],['R_thigh',thigh*(1-left)],['L_shin',shin*left],['R_shin',shin*(1-left)]])if(w>0)influences.set(body.skeleton.bones.findIndex(b=>b.name===name),w);
   }else {
    const nearest=[];
    for(let v=0;v<bp.count;v++){if(y<2.05&&Math.abs(x)>.08&&Math.sign(x)!==Math.sign(bp.getX(v)))continue;const d=(x-bp.getX(v))**2+(y-bp.getY(v))**2+(z-bp.getZ(v))**2;let at=nearest.findIndex(n=>d<n.d);if(at<0)at=nearest.length;if(at<4){nearest.splice(at,0,{v,d});nearest.length=Math.min(4,nearest.length);}}
    for(const {v,d}of nearest)for(let n=0;n<4;n++){const j=bi.array[v*4+n],w=bw.array[v*4+n]/Math.max(.00001,d);influences.set(j,(influences.get(j)??0)+w);}
   }
   const strongest=[...influences].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=strongest.reduce((s,[,w])=>s+w,0);
   for(let n=0;n<4;n++){joints.push(strongest[n]?.[0]??0);weights.push((strongest[n]?.[1]??0)/sum);}
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const m=new T.SkinnedMesh(g,new T.MeshStandardMaterial({color:def.color,roughness:.86,side:T.DoubleSide}));m.name='Lowerwear_'+def.id+'_'+k;body.parent.add(m);m.bind(body.skeleton,body.bindMatrix);meshes.push(m);
 }
 // All components share the same solid material and rig: one draw call per garment.
 const merged=mergeGeometries(meshes.map(m=>m.geometry),false);merged.computeBoundingBox();
 const garment=new T.SkinnedMesh(merged,meshes[0].material);garment.name='Lowerwear_'+def.id;
 for(const m of meshes)m.removeFromParent();body.parent.add(garment);garment.bind(body.skeleton,body.bindMatrix);meshes.splice(0,meshes.length,garment);
 const bounds=new T.Box3();for(const m of meshes)bounds.union(m.geometry.boundingBox);
 const meta={id:def.id,label:def.label,source:def.file+'.glb',triangles:meshes.reduce((s,m)=>s+m.geometry.index.count/3,0),hem:bounds.min.y,waist:2.49,skirt:!!def.skirt,color:def.color};
 if(pleats)meta.pleats=pleats;meta.status='standalone-tryon';meta.drawCalls=1;meta.limitations=def.skirt?['Deep seated folds still need dedicated cloth posing; no cloth simulation.']:[];
 root.userData.lowerwear=meta;
 await saveGlb(root,`${out}/${def.id}-rig.glb`);
 const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${out}/${def.id}-only.glb`);
 manifest.push(meta);console.log(meta);
}
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));

await fs.copyFile('art/chibi/pleated-skirt.mjs','output/cardigan-controller/pleated-skirt.js');
