import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';

const out='output/cardigan-controller/shoes';
const definitions=[
 {id:'geta',folder:'01a0bcd2-89bf-75c0-8e76-406afc5052b1',label:'木屐',parts:[2,3,4,5,6,7,8,9,10,11,12,13],colors:['#b99a76','#88738b'],opening:0,baseY:.46},
 {id:'boots',folder:'01a0bcd2-89cc-7412-b7da-34f7232815df',label:'系带短靴',parts:[2,3,4,5,6,7,8,9,10,11],colors:['#746e77','#ddd4c4'],opening:.50,baseY:.50},
 {id:'shorts',folder:'01a0bcd7-1799-7119-9c27-d260ca031cd1',label:'宽松短裤',parts:[1],colors:['#88959e'],shorts:true},
 {id:'sneakers',folder:'01a0bcd8-1508-738b-a069-a8a077190747',label:'厚底运动鞋',parts:[1,2,3,4,5,6,9,10,11,12,13,14,15,16],colors:['#ddd5cb','#96a6a5'],opening:.36,baseY:.50},
];
function openEnds(g,low,high){
 const p=g.attributes.position,idx=g.index,vertices=[];
 for(let i=0;i<idx.count;i+=3){let poly=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+k)));
  for(const distance of [v=>v.y-low,v=>high-v.y]){const next=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));}poly=next;}
  for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])vertices.push(...v.toArray());
 }const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(vertices,3));return mergeVertices(out,1e-5);
}
function sneakerCollar(side,target){
 // The source cuff is capped and intersects the new ankle. Replace only that
 // small part with an open, rounded band; retain the original shoe and laces.
 const positions=[],indices=[],ray=new T.Raycaster(),around=32,tube=8;
 for(let a=0;a<around;a++){const theta=a/around*Math.PI*2,dx=Math.cos(theta),dz=Math.sin(theta);
  for(let b=0;b<tube;b++){const phi=b/tube*Math.PI*2,y=.445-.025*dz+.085*Math.sin(phi);
   ray.set(new T.Vector3(side*.235,y,.025),new T.Vector3(dx,0,dz));ray.far=.8;
   const hit=ray.intersectObject(target)[0],r=(hit?.distance??.17)+.04+.03*Math.cos(phi);
   positions.push(side*.235+dx*r,y,.025+dz*r);
  }
 }
 for(let a=0;a<around;a++)for(let b=0;b<tube;b++){const i=a*tube+b,j=((a+1)%around)*tube+b,k=((a+1)%around)*tube+(b+1)%tube,l=a*tube+(b+1)%tube;indices.push(i,k,j,i,l,k);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);return g;
}
function shortsBands(g){
 const p=g.attributes.position,idx=g.index,vertices=[];
 for(let i=0;i<idx.count;i+=3){let polygons=[[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+k)))];
  for(const height of [2.30,2.15,2.00,1.85,1.70,1.55,1.40]){const next=[];for(const poly of polygons){if(poly.every(v=>v.y>=height)||poly.every(v=>v.y<=height)){next.push(poly);continue;}for(const sign of [-1,1]){const cut=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=sign*(a.y-height),db=sign*(b.y-height);if(da>=0)cut.push(a);if((da>=0)!==(db>=0))cut.push(a.clone().lerp(b,da/(da-db)));}if(cut.length>=3)next.push(cut);}}polygons=next;}
  for(const poly of polygons)for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])vertices.push(...v.toArray());
 }const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(vertices,3));return mergeVertices(result,1e-5);
}
function straightenShorts(g){
 // This doll has an almost straight waist/hip silhouette. Strip the source
 // human's pinched waist and rounded seat instead of padding them out.
 const p=g.attributes.position,original=p.array.slice(),idx=g.index,profiles=new Map();
 const section=y=>{
  const key=y.toFixed(5);if(profiles.has(key))return profiles.get(key);
  let width=0,front=-Infinity,back=Infinity;
  // Sample just inside open ends so both waistband and cuffs have a section.
  const h=T.MathUtils.clamp(y,1.256,2.4457);
  for(let i=0;i<idx.count;i+=3)for(let e=0;e<3;e++){
   const a=idx.getX(i+e)*3,b=idx.getX(i+(e+1)%3)*3,ya=original[a+1],yb=original[b+1];
   if((ya<h)===(yb<h))continue;const t=(h-ya)/(yb-ya),x=original[a]+(original[b]-original[a])*t,z=original[a+2]+(original[b+2]-original[a+2])*t;
   width=Math.max(width,Math.abs(x));front=Math.max(front,z);back=Math.min(back,z);
  }
  const result={width,front,back};profiles.set(key,result);return result;
 };
 for(let i=0;i<p.count;i++){
  const x=original[i*3],y=original[i*3+1],z=original[i*3+2],profile=section(y),t=T.MathUtils.clamp((y-1.255868)/(2.445868-1.255868),0,1);
  const width=T.MathUtils.lerp(.480,.455,t),front=T.MathUtils.lerp(.265,.360,t),back=T.MathUtils.lerp(-.185,-.220,t),center=.055;
  const depth=z>=center?(front-center)/(profile.front-center):(center-back)/(center-profile.back);
  p.setXYZ(i,x*width/profile.width,y,center+(z-center)*depth);
 }
 return g;
}
async function reference(){
 const b=await fs.readFile('output/cardigan-controller/sailor-girl.glb'),l=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+l)),bin=b.subarray(28+l);
 j.images=[];j.textures=[];j.materials=[{pbrMetallicRoughness:{baseColorFactor:[.82,.80,.76,1],roughnessFactor:.85,metallicFactor:0}}];for(const m of j.meshes)for(const p of m.primitives)p.material=0;
 const text=Buffer.from(JSON.stringify(j)),len=Math.ceil(text.length/4)*4,bytes=Buffer.alloc(28+len+bin.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(len,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.fill(32,20,20+len);text.copy(bytes,20);bytes.writeUInt32LE(bin.length,20+len);bytes.writeUInt32LE(0x004e4942,24+len);bin.copy(bytes,28+len);
 const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
 const remove=[];scene.traverse(o=>{if(o.name.startsWith('Sailor_')&&o.parent?.name==='CurrentBody')remove.push(o);});for(const o of remove)o.removeFromParent();return scene;
}
await fs.mkdir(out,{recursive:true});const manifest=[];
for(const def of definitions){
 const [source]=await readGeometry(`output/shoes-0920/source/${def.folder}/Meshy_AI_model.glb`),parts=splitParts(source);
 const root=await reference(),body=root.getObjectByName('Mesh_0'),bp=body.geometry.attributes.position,bi=body.geometry.attributes.skinIndex,bw=body.geometry.attributes.skinWeight;
 const target=new T.Mesh(body.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));target.updateMatrixWorld();const ray=new T.Raycaster();
 const buckets=def.colors.map(()=>[]);
 for(const k of def.parts){let g=await compactGeometry(source,parts[k].ids);
  if(def.shorts)g=openEnds(g,-.155,.020);
  let p=g.attributes.position;const side=parts[k].center.x<0?-1:1,sideName=side<0?'R':'L';
  for(let i=0;i<p.count;i++){
   let x,y,z;
   if(def.shorts){x=p.getX(i)*4.85;y=2.49+(p.getY(i)-.02649)*6.8;z=p.getZ(i)*4.85;const centerX=Math.sign(x)*.235*(1-T.MathUtils.smoothstep(y,1.50,1.95)),dz=z-.015,dx=x-centerX,r=Math.hypot(dx,dz);if(r>.001){ray.set(new T.Vector3(centerX,y,.015),new T.Vector3(dx/r,0,dz/r));ray.far=.9;const hit=ray.intersectObject(target)[0];if(hit&&hit.distance+.05>r){const s=(hit.distance+.05)/r;x=centerX+dx*s;z=.015+dz*s;}}}
   else {x=side*.235+(p.getX(i)-side*.045)*4.5;y=(p.getY(i)+def.baseY)*4.5;z=p.getZ(i)*4.3;
    if(def.id==='geta'&&k<6){ray.set(new T.Vector3(x,.65,z),new T.Vector3(0,-1,0));ray.far=.7;const hit=ray.intersectObject(target)[0];if(hit&&hit.point.y<.55)y=hit.point.y+.026+g.attributes.normal.getY(i)*.012;}
    else if(def.id!=='geta'){const s=1+.45*T.MathUtils.smoothstep(y,.22,.48);x=side*.235+(x-side*.235)*s;z=.025+(z-.025)*s;if(def.id==='sneakers'&&(k===3||k===5))z+=.06;}
   }
   p.setXYZ(i,x,y,z);
  }
  if(def.id==='sneakers'&&(k===4||k===6)){g=sneakerCollar(side,target);p=g.attributes.position;}
  if((def.id==='boots'&&k<=3)||(def.id==='sneakers'&&k<=2)){g=openEnds(g,-10,def.id==='boots'?.55:.385);p=g.attributes.position;}
  if(def.shorts){g=straightenShorts(shortsBands(g));p=g.attributes.position;}
  g.computeVertexNormals();const joints=[],weights=[];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let list;
   if(!def.shorts){const foot=body.skeleton.bones.findIndex(b=>b.name===sideName+'_foot'),shin=body.skeleton.bones.findIndex(b=>b.name===sideName+'_shin');const t=def.id==='geta'?0:T.MathUtils.smoothstep(y,.30,.58);list=[[foot,1-t],[shin,t]];}
   else {const nearest=[];for(let v=0;v<bp.count;v++){if(y<2.04&&Math.abs(x)>.06&&Math.sign(x)!==Math.sign(bp.getX(v)))continue;const d=(x-bp.getX(v))**2+(y-bp.getY(v))**2+(z-bp.getZ(v))**2;let at=nearest.findIndex(n=>d<n.d);if(at<0)at=nearest.length;if(at<4){nearest.splice(at,0,{v,d});nearest.length=Math.min(4,nearest.length);}}const map=new Map();for(const {v,d}of nearest)for(let n=0;n<4;n++){const j=bi.array[v*4+n],w=bw.array[v*4+n]/Math.max(.00001,d);map.set(j,(map.get(j)??0)+w);}list=[...map].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4);}
   if(def.shorts&&y<2.05){const t=1-T.MathUtils.smoothstep(y,1.60,2.05),thigh=body.skeleton.bones.findIndex(b=>b.name===(x<0?'R':'L')+'_thigh'),hips=body.skeleton.bones.findIndex(b=>b.name==='hips');list=[[thigh,t],[hips,1-t]];}
   const total=list.reduce((s,[,w])=>s+w,0);for(let n=0;n<4;n++){joints.push(list[n]?.[0]??0);weights.push((list[n]?.[1]??0)/total);}
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const material=def.id==='geta'?(k<6?1:0):def.id==='boots'?(k>=4?1:0):def.id==='sneakers'?([3,4,5,6,7,8].includes(k)?1:0):0;buckets[material].push(g);
 }
 const meshes=[];for(const [i,geos] of buckets.entries())if(geos.length){const g=mergeGeometries(geos,false);g.computeBoundingBox();const m=new T.SkinnedMesh(g,new T.MeshStandardMaterial({color:def.colors[i],roughness:.85,side:T.DoubleSide}));m.name=(def.shorts?'Lowerwear_':'Footwear_')+def.id+'_'+i;body.parent.add(m);m.bind(body.skeleton,body.bindMatrix);meshes.push(m);}
 const bounds=new T.Box3();meshes.forEach(m=>bounds.union(m.geometry.boundingBox));
 const triangles=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0),meta={id:def.id,label:def.label,folder:def.folder,triangles,status:'standalone-tryon',drawCalls:meshes.length};
 if(def.shorts){meta.hem=bounds.min.y;meta.waist=2.49;meta.skirt=false;root.userData.lowerwear=meta;}
 else {meta.opening=def.opening;meta.groundOffset=Math.max(0,-bounds.min.y);body.parent.position.y+=meta.groundOffset;root.userData.footwear=meta;}
 await saveGlb(root,`${out}/${def.id}-rig.glb`);
 const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${out}/${def.id}-only.glb`);
 manifest.push(meta);console.log(meta);
}
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
