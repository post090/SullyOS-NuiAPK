import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';

const out='output/cardigan-controller/procedural-basics';await fs.mkdir(out,{recursive:true});
const bodySource='output/clothing-rebuild-0920/wardrobe-current-body.glb';
async function reference(){const b=await fs.readFile(bodySource);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene;}
const smooth=T.MathUtils.smoothstep,clamp=T.MathUtils.clamp;
const crewHeight=v=>3.32-.10*(1-smooth(Math.abs(v.x),.10,.26))*smooth(v.z,-.04,.14);
const shoulderStrap=v=>{
 const ax=Math.abs(v.x),front=smooth(v.z,-.04,.12);
 return T.MathUtils.lerp(3.10,3.00,front)+.38*smooth(ax,.12,.185)*(1-smooth(ax,.27,.32));
};
const camisoleNeck=v=>{
 const ax=Math.abs(v.x),front=smooth(v.z,-.04,.12),base=T.MathUtils.lerp(3.08,3.02,front);
 return base+.04*Math.pow(clamp(ax/.14,0,1),2)+.34*smooth(ax,.14,.18)*(1-smooth(ax,.22,.26));
};
const armHole=v=>.47-.205*smooth(v.y,2.60,2.96)-Math.abs(v.x);
const defs=[
 {id:'fitted-camisole',label:'女式吊带背心',slot:'top',color:'#eadedb',offset:.019,hem:2.20,sleeveless:true,fields:[v=>v.y-2.20,armHole,v=>camisoleNeck(v)-v.y]},
 {id:'fitted-turtleneck',label:'贴身高领毛衣',slot:'top',color:'#b5a99a',offset:.029,hem:2.18,longSleeves:true,fields:[v=>v.y-2.18,v=>3.45-v.y]},
 {id:'fitted-sweater',label:'贴身圆领毛衣',slot:'top',color:'#b1bac4',offset:.027,hem:2.18,longSleeves:true,morph:'VNeck',fields:[v=>v.y-2.18,v=>crewHeight(v)-v.y]},
 {id:'school-swimsuit',label:'连体校园泳衣',slot:'onepiece',color:'#25334b',offset:.019,hem:1.98,sleeveless:true,fields:[v=>v.y-(1.98+.23*Math.pow(clamp(Math.abs(v.x)/.44,0,1.4),1.3)),armHole,v=>shoulderStrap(v)+.035-v.y]},
];
const unitWeights=map=>{const entries=[...map].filter(([,w])=>w>1e-9).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=entries.reduce((n,[,w])=>n+w,0);return entries.map(([j,w])=>[j,w/sum]);};
const interpolate=(a,b,t)=>{
 const weights=new Map();for(const[j,w]of a.weights)weights.set(j,(weights.get(j)??0)+w*(1-t));for(const[j,w]of b.weights)weights.set(j,(weights.get(j)??0)+w*t);
 return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),weights:unitWeights(weights)};
};
function cutPolygon(polygon,field,linear=false){
 const result=[];for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],da=field(a.p),db=field(b.p),inside=da>=0;
  if(inside)result.push(a);
  if(inside!==(db>=0)){
   let t;if(linear)t=da/(da-db);else {let lo=0,hi=1;for(let k=0;k<24;k++){const mid=(lo+hi)/2,value=field(a.p.clone().lerp(b.p,mid));if((value>=0)===inside)lo=mid;else hi=mid;}t=(lo+hi)/2;}
   result.push(interpolate(a,b,t));
  }
 }return result;
}
function partitionStraps(polygon,def){
 // A narrow shoulder band can lie entirely between a source triangle's
 // corners. Cut exact x stations first so its front-to-back bridge cannot
 // disappear merely because the original body topology missed the band.
 if(!def.sleeveless)return [polygon];
 const lower=cutPolygon(polygon,v=>3.10-v.y,true),upper=cutPolygon(polygon,v=>v.y-3.10,true);
 let patches=upper.length>=3?[upper]:[];
 const stations=def.id==='fitted-camisole'?[.14,.18,.22,.26]:[.12,.185,.27,.32];
 for(const x of [...stations.map(x=>-x).reverse(),...stations]){
  patches=patches.flatMap(p=>[cutPolygon(p,v=>x-v.x,true),cutPolygon(p,v=>v.x-x,true)].filter(q=>q.length>=3));
 }
 return lower.length>=3?[lower,...patches]:patches;
}
function clippedShell(body,def){
 const g=body.geometry,p=g.attributes.position,n=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const source=Array.from({length:p.count},(_,i)=>({p:new T.Vector3().fromBufferAttribute(p,i),n:new T.Vector3().fromBufferAttribute(n,i).normalize(),weights:unitWeights(new Map(Array.from({length:4},(_,k)=>[si.getComponent(i,k),sw.getComponent(i,k)])))}));
 const vertices=[],indices=[],lookup=new Map();
 const add=v=>{const key=v.p.toArray().map(c=>Math.round(c*1e5)).join(',');if(lookup.has(key))return lookup.get(key);const id=vertices.length;vertices.push({...v,offset:def.offset});lookup.set(key,id);return id;};
 for(let i=0;i<g.index.count;i+=3){
  const original=[0,1,2].map(k=>source[g.index.getX(i+k)]);
  let patches=[original];
  // Add samples before cutting curved straps, avoiding a long source triangle
  // skipping both sides of a narrow strap when all three corners are outside.
  if(def.sleeveless){
   const [a,b,c]=original,ab=interpolate(a,b,.5),bc=interpolate(b,c,.5),ca=interpolate(c,a,.5);patches=[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];
  }
  for(let polygon of patches.flatMap(p=>partitionStraps(p,def))){
  for(const field of def.fields){polygon=cutPolygon(polygon,field);if(polygon.length<3)break;}
  if(polygon.length<3)continue;
  for(let k=1;k<polygon.length-1;k++){const tri=[add(polygon[0]),add(polygon[k]),add(polygon[k+1])];if(new Set(tri).size===3)indices.push(...tri);}
  }
 }
 // The chin and inner arm can intersect a neckline's mathematical height
 // without belonging to the garment. Keep the connected torso shell only.
 const parent=Int32Array.from({length:vertices.length},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<indices.length;i+=3){const a=find(indices[i]);parent[find(indices[i+1])]=a;parent[find(indices[i+2])]=a;}
 const components=new Map();for(let i=0;i<indices.length;i+=3){const key=find(indices[i]);if(!components.has(key))components.set(key,[]);components.get(key).push(...indices.slice(i,i+3));}
 const largest=[...components.values()].sort((a,b)=>b.length-a.length)[0],used=new Map(),compact=[];
 const finalIndices=largest.map(id=>{if(!used.has(id)){used.set(id,compact.length);compact.push(vertices[id]);}return used.get(id);});
 vertices.splice(0,vertices.length,...compact);indices.splice(0,indices.length,...finalIndices);
 // A thin folded edge follows each exact cut boundary. It stays outside the
 // body, and adds no detached trim geometry or opaque caps over the openings.
 const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
 const inner=new Map(),innerVertex=id=>{if(!inner.has(id)){inner.set(id,vertices.length);vertices.push({...vertices[id],offset:def.offset-.008});}return inner.get(id);};
 for(const {a,b,count} of edges.values())if(count===1){const ia=innerVertex(a),ib=innerVertex(b);indices.push(b,a,ia,b,ia,ib);}
 const positions=[],normals=[],joints=[],weights=[];
 for(const v of vertices){positions.push(...v.p.clone().addScaledVector(v.n,v.offset).toArray());normals.push(...v.n.toArray());for(let k=0;k<4;k++){joints.push(v.weights[k]?.[0]??0);weights.push(v.weights[k]?.[1]??0);}}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));result.setIndex(indices);
 return {geometry:result,vertices,boundaryEdges:[...edges.values()].filter(e=>e.count===1).length};
}
function addVNeck(geometry,vertices,body){
 const surface=new T.Mesh(body.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.updateMatrixWorld();
 const ray=new T.Raycaster(),positions=[],p=body.geometry.attributes.position,n=body.geometry.attributes.normal;
 for(const vertex of vertices){
  const v=vertex.p,front=smooth(v.z,.06,.16),limit=crewHeight(v),target=3.00+.32*clamp(Math.abs(v.x)/.24,0,1);
  const shift=Math.max(0,limit-target)*clamp((v.y-2.60)/(limit-2.60),0,1)*front;
  let point=v.clone().addScaledVector(vertex.n,vertex.offset);
  if(shift>1e-6&&Math.abs(v.x)<.3){
   ray.set(new T.Vector3(v.x,v.y-shift,1),new T.Vector3(0,0,-1));ray.far=2;const hit=ray.intersectObject(surface)[0];
   if(hit){const ids=[hit.face.a,hit.face.b,hit.face.c],bary=T.Triangle.getBarycoord(hit.point,...ids.map(i=>new T.Vector3().fromBufferAttribute(p,i)),new T.Vector3());const normal=new T.Vector3();for(let k=0;k<3;k++)normal.addScaledVector(new T.Vector3().fromBufferAttribute(n,ids[k]),bary.getComponent(k));normal.normalize();point=hit.point.clone().addScaledVector(normal,vertex.offset);}
  }
  positions.push(...point.toArray());
 }
 const target=geometry.clone();target.setAttribute('position',new T.Float32BufferAttribute(positions,3));target.computeVertexNormals();const position=target.attributes.position,normal=target.attributes.normal;
 for(let i=0;i<position.count;i++){
  const before=new T.Vector3().fromBufferAttribute(geometry.attributes.position,i),after=new T.Vector3().fromBufferAttribute(position,i),blend=smooth(before.distanceTo(after),0,.015);
  const original=new T.Vector3().fromBufferAttribute(geometry.attributes.normal,i),changed=new T.Vector3().fromBufferAttribute(normal,i);original.lerp(changed,blend).normalize();normal.setXYZ(i,original.x,original.y,original.z);
 }
 position.name='VNeck';normal.name='VNeck';geometry.morphAttributes.position=[position];geometry.morphAttributes.normal=[normal];geometry.morphTargetsRelative=false;surface.material.dispose();
}
const manifest=[];
for(const def of defs){
 const root=await reference(),body=root.getObjectByName('Mesh_0');
 root.updateMatrixWorld(true);
 if(def.longSleeves){const hand=body.skeleton.bones.find(b=>b.name==='L_hand').getWorldPosition(new T.Vector3());def.fields.push(v=>hand.x-.075-Math.abs(v.x));}
 const {geometry,vertices,boundaryEdges}=clippedShell(body,def);
 if(def.morph)addVNeck(geometry,vertices,body);
 const triangles=geometry.index.count/3;if(triangles>=4000)throw Error(`${def.id} exceeds budget: ${triangles}`);
 const material=new T.MeshStandardMaterial({color:def.color,roughness:.94,metalness:0,side:T.DoubleSide});
 const mesh=new T.SkinnedMesh(geometry,material);mesh.name=`Apparel_${def.id}`;body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);
 const meta={id:def.id,label:def.label,slot:def.slot,asset:`${def.id}-rig.glb`,prefix:'Apparel_',triangles,vertices:geometry.attributes.position.count,boundaryEdges,hem:def.hem,sleeveless:!!def.sleeveless,morph:def.morph??null,source:bodySource,clearance:def.offset,revision:'surface-current-0920-3'};
 root.userData.apparel=meta;await saveGlb(root,`${out}/${def.id}-rig.glb`);
 const onlyGeometry=geometry.clone();onlyGeometry.deleteAttribute('skinIndex');onlyGeometry.deleteAttribute('skinWeight');const only=new T.Mesh(onlyGeometry,material);only.name=mesh.name;await saveGlb(only,`${out}/${def.id}-only.glb`);
 await fs.copyFile(`${out}/${def.id}-rig.glb`,`public/room3d/wardrobe/${def.id}-rig.glb`);manifest.push(meta);console.log(JSON.stringify(meta));
 await fs.copyFile(`${out}/${def.id}-only.glb`,`public/room3d/wardrobe/${def.id}-only.glb`);
}
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
