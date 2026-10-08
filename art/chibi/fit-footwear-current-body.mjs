// Repeatable fit of three boots, buckle shoes and the sneaker collar.
// Preserve topology, materials and details; fit the current straight-leg doll.
import fs from 'node:fs/promises';import path from 'node:path';import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const out='output/footwear-fit-0921',backup=out+'/before';await fs.mkdir(backup,{recursive:true});
const defs=[{id:'lace-midboots',dir:'clothing-0920b',top:.984},{id:'tall-boots',dir:'clothing-0920b',top:1.248},{id:'boots',dir:'shoes',top:.55},{id:'buckle-shoes',dir:'clothing-0920b',top:.3936,low:true},{id:'sneakers',dir:'shoes',top:.385,low:true}];
const load=async file=>{const b=await fs.readFile(file);const r=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene;r.updateMatrixWorld(true);return r;};
const body=(await load('output/clothing-rebuild-0920/wardrobe-current-body.glb')).getObjectByName('Mesh_0'),bp=body.geometry.attributes.position;
const bodySurface=new T.Mesh(body.geometry,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster();bodySurface.updateMatrixWorld();
function owner(g,i,bones){const si=g.attributes.skinIndex,sw=g.attributes.skinWeight;let l=0,r=0;for(let k=0;k<4;k++){const n=bones[si.getComponent(i,k)].name,w=sw.getComponent(i,k);if(n.startsWith('L_'))l+=w;if(n.startsWith('R_'))r+=w;}return l>=r?1:-1;}
const leftBody=[];for(let i=0;i<bp.count;i++)if(owner(body.geometry,i,body.skeleton.bones)>0)leftBody.push(new T.Vector3().fromBufferAttribute(bp,i));
const lerp=T.MathUtils.lerp,smooth=T.MathUtils.smoothstep;
function ellipse(points,margin){const box=new T.Box3().setFromPoints(points),c=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),rx=size.x/2,rz=size.z/2,scale=Math.max(...points.map(p=>Math.hypot((p.x-c.x)/rx,(p.z-c.z)/rz)));return{cx:c.x,cz:c.z,rx:rx*scale+margin,rz:rz*scale+margin};}
function parse(b){const l=b.readUInt32LE(12);return{j:JSON.parse(b.subarray(20,20+l)),bin:Buffer.from(b.subarray(28+l))};}
function access(a,id){const d=a.j.accessors[id],v=a.j.bufferViews[d.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[d.type],size={5121:1,5123:2,5125:4,5126:4}[d.componentType],start=(v.byteOffset??0)+(d.byteOffset??0),stride=v.byteStride??n*size;return{d,read:(i,k)=>{const at=start+i*stride+k*size;return d.componentType===5126?a.bin.readFloatLE(at):d.componentType===5123?a.bin.readUInt16LE(at):a.bin.readUInt8(at);},write:(i,k,x)=>{const at=start+i*stride+k*size;if(d.componentType===5126)a.bin.writeFloatLE(x,at);else if(d.componentType===5123)a.bin.writeUInt16LE(x,at);else a.bin.writeUInt8(x,at);}};}
function serialize({j,bin}){const s=Buffer.from(JSON.stringify(j)),l=Math.ceil(s.length/4)*4,o=Buffer.alloc(28+l+bin.length);o.writeUInt32LE(0x46546c67);o.writeUInt32LE(2,4);o.writeUInt32LE(o.length,8);o.writeUInt32LE(l,12);o.writeUInt32LE(0x4e4f534a,16);o.fill(32,20,20+l);s.copy(o,20);o.writeUInt32LE(bin.length,20+l);o.writeUInt32LE(0x004e4942,24+l);bin.copy(o,28+l);return o;}
async function original(file){const target=backup+'/'+file;await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.access(target);}catch{await fs.copyFile(file,target);}return target;}
const reports=[];
for(const d of defs){if(process.argv[2]&&process.argv[2]!==d.id)continue;
 const rig=`output/cardigan-controller/${d.dir}/${d.id}-rig.glb`,src=await original(rig),root=await load(src),meshes=[];root.traverse(m=>{if(m.isSkinnedMesh&&m.name.startsWith('Footwear_'))meshes.push(m);});
 const main=meshes[0],p=main.geometry.attributes.position,pts=Array.from({length:p.count},(_,i)=>({p:new T.Vector3().fromBufferAttribute(p,i),s:owner(main.geometry,i,main.skeleton.bones)})).filter(v=>v.s>0).map(v=>v.p),shaftPts=pts.filter(p=>p.y>=d.top-.001),oldBox=new T.Box3().setFromPoints(shaftPts),oc=oldBox.getCenter(new T.Vector3()),os=oldBox.getSize(new T.Vector3());
 const target=ellipse(leftBody.filter(p=>p.y>=.35&&p.y<=d.top+.12),.021);if(d.id==='boots'){target.rx=os.x/2;target.rz=os.z/2;}
 const footBody=new T.Box3().setFromPoints(leftBody.filter(p=>p.y<=.29)),oldFoot=new T.Box3().setFromPoints(pts.filter(p=>p.y<=.20)),footX=(footBody.min.x+footBody.max.x)/2,oldFootX=(oldFoot.min.x+oldFoot.max.x)/2;
 const footSX=Math.max(1,(footBody.max.x-footBody.min.x+.046)/(oldFoot.max.x-oldFoot.min.x)),zMin=Math.min(oldFoot.min.z,footBody.min.z-.025),zMax=Math.max(oldFoot.max.z,footBody.max.z+.030);
 const changes=new Map();
 for(const m of meshes){const g=m.geometry.clone(),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,bones=m.skeleton.bones,bone=n=>bones.findIndex(b=>b.name===n),collar=new Set();
  const collarPoint=new Map();
  if(d.id==='sneakers'&&m!==main){const parents=Array.from({length:p.count},(_,i)=>i),find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));for(let t=0;t<g.index.count;t+=3)for(let k=1;k<3;k++)parents[find(g.index.getX(t+k))]=find(g.index.getX(t));const groups=new Map();for(let i=0;i<p.count;i++){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);}for(const ids of groups.values())if(ids.length===256){ids.sort((a,b)=>a-b);ids.forEach((i,k)=>{collar.add(i);const s=owner(g,i,bones),a=Math.floor(k/8)/32*Math.PI*2,b=(k%8)/8*Math.PI*2;collarPoint.set(i,new T.Vector3(s*.221+Math.cos(a)*(.193+.022*Math.cos(b)),.355-.015*Math.sin(a)+.078*Math.sin(b),.023+Math.sin(a)*(.219+.024*Math.cos(b))));});}if(collar.size!==512)throw Error('Expected two sneaker collar rings');}
  for(let i=0;i<p.count;i++){const s=owner(g,i,bones),x=p.getX(i)*s,y=p.getY(i)-(collar.has(i)?.085:0),z=p.getZ(i),t=d.low?0:smooth(y,.16,.44),fx=footX+(x-oldFootX)*footSX,fz=zMin+(z-oldFoot.min.z)/(oldFoot.max.z-oldFoot.min.z)*(zMax-zMin),sx=target.cx+(x-oc.x)/(os.x/2)*target.rx,sz=target.cz+(z-oc.z)/(os.z/2)*target.rz;
   const point=d.id==='sneakers'?(collarPoint.get(i)??new T.Vector3().fromBufferAttribute(p,i)):new T.Vector3(s*lerp(fx,sx,t),y,lerp(fz,sz,t));
   p.setXYZ(i,point.x,point.y,point.z);
   const shin=smooth(y,.159,.371),thigh=smooth(y,.900,1.218),side=s>0?'L':'R',list=[[bone(side+'_foot'),1-shin],[bone(side+'_shin'),shin*(1-thigh)],[bone(side+'_thigh'),shin*thigh],[0,0]];
   for(let k=0;k<4;k++){si.setComponent(i,k,list[k][0]);sw.setComponent(i,k,list[k][1]);}
  }
  changes.set(m.name,g);
 }
 // Displace all radial layers by the same smooth local field. Projecting
 // each wall directly onto the body collapses inner/outer walls, causing the
 // previous dark shard artifacts at a boot rim or padded sneaker collar.
 const seeds=[],pending=[];
 for(const m of meshes){const g=changes.get(m.name),p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);if(d.id==='sneakers'||y<.035||y>=(d.id==='boots'||d.low?.65:.48))continue;const s=owner(g,i,m.skeleton.bones),v=new T.Vector3().fromBufferAttribute(p,i),origin=new T.Vector3(s*target.cx,Math.max(.035,y),target.cz),direction=v.clone().sub(origin);direction.y=0;const r=direction.length(),a=Math.atan2(direction.z,direction.x*s);direction.normalize();ray.set(origin,direction);ray.far=.8;const hit=ray.intersectObject(bodySurface)[0],need=hit?Math.max(0,hit.distance+.034-r):0;const item={g,i,s,y,a,r,direction,need};pending.push(item);if(need>0)seeds.push(item);}}
 for(const v of pending){let delta=v.need;for(const n of seeds){if(v.s!==n.s||Math.abs(v.y-n.y)>.11)continue;let angle=Math.abs(v.a-n.a);angle=Math.min(angle,Math.PI*2-angle);const dist=Math.hypot((v.y-n.y)*.8,angle*.15);if(dist<.09)delta=Math.max(delta,n.need*(1-smooth(dist,.018,.09)));}const p=v.g.attributes.position;p.setX(v.i,p.getX(v.i)+v.direction.x*delta);p.setZ(v.i,p.getZ(v.i)+v.direction.z*delta);}
 if(d.id==='boots'){
  // The source short boots have wide inner ankle panels. Retain their wall
  // thickness but keep the two boots separate in the narrow default stance.
  // Only tuck the part that crosses the midline: squeezing the entire inner
  // half would move an already-fitted panel inside the leg and expose skin.
  for(const m of meshes){const g=changes.get(m.name),p=g.attributes.position;for(let i=0;i<p.count;i++){const s=owner(g,i,m.skeleton.bones),x=p.getX(i)*s;if(x<.028){const fitted=.008+.020*Math.exp((x-.028)/.035);p.setX(i,s*lerp(x,fitted,smooth(p.getY(i),.16,.31)));}}}
 }
 for(const m of meshes){const g=changes.get(m.name),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,bones=m.skeleton.bones;for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i),s=owner(g,i,bones),side=s>0?'L':'R',shin=smooth(y,.159,.371)*(1-smooth(z,.08,.32)*(1-smooth(y,.30,.48))),thigh=smooth(y,.900,1.218),list=[[bones.findIndex(b=>b.name===side+'_foot'),1-shin],[bones.findIndex(b=>b.name===side+'_shin'),shin*(1-thigh)],[bones.findIndex(b=>b.name===side+'_thigh'),shin*thigh],[0,0]];for(let k=0;k<4;k++){si.setComponent(i,k,list[k][0]);sw.setComponent(i,k,list[k][1]);}}g.computeVertexNormals();if(d.id!=='boots'&&!d.low&&m===main){const n=g.attributes.normal;for(let i=0;i<p.count;i++)if(p.getY(i)>=.5-1e-6){const s=owner(g,i,m.skeleton.bones),v=new T.Vector3((p.getX(i)-s*target.cx)/(target.rx**2),0,(p.getZ(i)-target.cz)/(target.rz**2)).normalize();n.setXYZ(i,v.x,v.y,v.z);}}}
 const files=[rig,`output/cardigan-controller/${d.dir}/${d.id}-only.glb`,`public/room3d/wardrobe/${d.id}-rig.glb`];
 for(const file of files){const a=parse(await fs.readFile(await original(file)));for(const n of a.j.nodes){if(!changes.has(n.name)||n.mesh===undefined)continue;const g=changes.get(n.name);for(const prim of a.j.meshes[n.mesh].primitives){for(const [name,attr]of[['POSITION','position'],['NORMAL','normal'],['JOINTS_0','skinIndex'],['WEIGHTS_0','skinWeight']]){if(prim.attributes[name]===undefined)continue;const dst=access(a,prim.attributes[name]),v=g.attributes[attr];if(dst.d.count!==v.count)throw Error('Vertex count differs '+file+'/'+n.name);for(let i=0;i<v.count;i++)for(let k=0;k<v.itemSize;k++)dst.write(i,k,v.getComponent(i,k));if(name==='POSITION'){g.computeBoundingBox();dst.d.min=g.boundingBox.min.toArray();dst.d.max=g.boundingBox.max.toArray();}}}}a.j.extras={...a.j.extras,currentBodyBootFit:'2026-09-21-v1'};await fs.writeFile(file,serialize(a));}
 reports.push({id:d.id,targetEllipse:target,oldEllipse:{cx:oc.x,cz:oc.z,rx:os.x/2,rz:os.z/2},footX,oldFootX,footSX,zMin,zMax,triangles:meshes.reduce((s,m)=>s+m.geometry.index.count/3,0),files});
}
await fs.writeFile(out+'/fit-report.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
if(reports.some(d=>d.id==='sneakers')){
 const file='output/cardigan-controller/shoes/manifest.json',manifest=JSON.parse(await fs.readFile(file,'utf8'));
 const item=manifest.find(d=>d.id==='sneakers');if(!item)throw Error('Sneaker manifest entry missing');
 item.opening=.418;await fs.writeFile(file,JSON.stringify(manifest,null,2));
}
