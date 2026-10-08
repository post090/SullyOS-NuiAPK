import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';
import {reference} from './tailored-current-body.mjs';
import {surfaceBinding,bindGeometry} from './clothing-details.mjs';

// A straight Japanese school-uniform block on the actual wardrobe body.
// The source contributes the buttons and pocket flaps. The body-derived
// shoulder has no raised sleeve head; its sleeve widens towards the cuff.
const sourcePath='output/clothing-rebuild-0920/input/Meshy_AI_Porcelain_Bellhop_0920125827_generate.glb';
const [source]=await readGeometry(sourcePath),parts=splitParts(source);
const root=await reference(),body=root.getObjectByName('Mesh_0'),binding=surfaceBinding(body);
const smooth=T.MathUtils.smoothstep;
const hem=2.10,neck=3.355,cuff=1.575,clearance=.031;
const unit=map=>{const list=[...map].filter(([,w])=>w>1e-9).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=list.reduce((s,[,w])=>s+w,0);return list.map(([j,w])=>[j,w/sum]);};
const mix=(a,b,t)=>{const weights=new Map();for(const[j,w]of a.weights)weights.set(j,(weights.get(j)??0)+(1-t)*w);for(const[j,w]of b.weights)weights.set(j,(weights.get(j)??0)+t*w);return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),weights:unit(weights)};};
function cut(poly,field){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=field(a.p),db=field(b.p);if(da>=0)result.push(a);if((da>=0)!==(db>=0))result.push(mix(a,b,da/(da-db)));}return result;}
function shape(v){
 const p=v.p,ax=Math.abs(p.x),q=p.clone().addScaledVector(v.n,clearance);
 // One constant lower cross-section; a mild superellipse flattens the front.
 const torso=(1-smooth(p.y,2.84,3.12))*(1-smooth(ax,.44,.61));
 if(torso){const a=Math.atan2(p.x/.46,(p.z-.045)/.385),s=Math.sin(a),c=Math.cos(a),target=new T.Vector3(.466*Math.sign(s)*Math.pow(Math.abs(s),.79),p.y,.045+.385*Math.sign(c)*Math.pow(Math.abs(c),.79));q.lerp(target,torso);}
 // Keep the first shoulder section close, then widen gently towards the cuff.
 const sleeve=smooth(ax,.39,.64);
 if(sleeve){const dy=p.y-3.125,dz=(p.z-.022)/1.05,a=Math.atan2(dz,dy),r=Math.max(Math.hypot(dy,dz)+.024,.170+.061*smooth(ax,.49,cuff));const target=new T.Vector3(p.x,3.125+r*Math.cos(a),.022+1.05*r*Math.sin(a));q.lerp(target,sleeve);}
 // Keep the inner arm fold clear when the arm crosses the chest. This adds
 // allowance only below the arm; the visible shoulder crown stays unchanged.
 const underarm=smooth(ax,.31,.41)*(1-smooth(ax,.66,.80))*(1-smooth(p.y,3.01,3.095));
 q.y-=.033*underarm;q.z+=.031*underarm*Math.sign(p.z-.012);
 // The coarse rear-shoulder triangles turn through the arm/chest bend.
 // A small local allowance follows that corner through both standing and
 // bent-arm poses without changing the front shoulder's fitted silhouette.
 const rearShoulder=smooth(ax,.12,.22)*(1-smooth(ax,.72,.86))*smooth(p.y,3.14,3.24)*(1-smooth(p.z,-.025,.04));
 q.x+=Math.sign(p.x)*.041*rearShoulder;q.y+=.027*rearShoulder;q.z=T.MathUtils.lerp(q.z,p.z+.006,rearShoulder);
 if(Math.abs(p.y-hem)<1e-5)q.y=hem;
 if(Math.abs(ax-cuff)<1e-5)q.x=Math.sign(p.x)*cuff;
 return q;
}
const g=body.geometry,p=g.attributes.position,n=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
const samples=Array.from({length:p.count},(_,i)=>({p:new T.Vector3().fromBufferAttribute(p,i),n:new T.Vector3().fromBufferAttribute(n,i).normalize(),weights:unit(new Map(Array.from({length:4},(_,k)=>[si.getComponent(i,k),sw.getComponent(i,k)])))}));
let vertices=[],indices=[];const lookup=new Map();
const add=v=>{const key=v.p.toArray().map(x=>Math.round(x*1e5)).join(',');if(lookup.has(key))return lookup.get(key);const id=vertices.length;vertices.push(v);lookup.set(key,id);return id;};
for(let i=0;i<g.index.count;i+=3){let polygon=[0,1,2].map(k=>samples[g.index.getX(i+k)]);for(const field of [v=>v.y-hem,v=>neck-v.y,v=>cuff-Math.abs(v.x)])polygon=cut(polygon,field);for(let j=1;j<polygon.length-1;j++){const ids=[add(polygon[0]),add(polygon[j]),add(polygon[j+1])];if(new Set(ids).size===3)indices.push(...ids);}}
// Discard disconnected underside-of-head fragments after the neck cut.
const parent=Int32Array.from({length:vertices.length},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
for(let i=0;i<indices.length;i+=3){const a=find(indices[i]);parent[find(indices[i+1])]=a;parent[find(indices[i+2])]=a;}
const components=new Map();for(let i=0;i<indices.length;i+=3){const key=find(indices[i]);if(!components.has(key))components.set(key,[]);components.get(key).push(...indices.slice(i,i+3));}
const largest=[...components.values()].sort((a,b)=>b.length-a.length)[0],remap=new Map(),compact=[];indices=largest.map(id=>{if(!remap.has(id)){remap.set(id,compact.length);compact.push(vertices[id]);}return remap.get(id);});vertices=compact;
const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const a=indices[i+j],b=indices[i+(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
const positions=vertices.map(shape),skin=vertices.map(v=>v.weights),quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d),push=(point,w)=>{const id=positions.length;positions.push(point);skin.push(w);return id;};
const collarTop=new Map(),inner=new Map();
function top(id){if(!collarTop.has(id)){const v=positions[id].clone(),front=smooth(v.z,.09,.20),notch=(1-smooth(Math.abs(v.x),.005,.043))*front;v.y+=.086-.040*notch;collarTop.set(id,push(v,skin[id]));}return collarTop.get(id);}
function rim(id){if(!inner.has(id)){const v=positions[id].clone();if(Math.abs(v.x)>1.5){v.y=3.125+(v.y-3.125)*.965;v.z=.022+(v.z-.022)*.965;}else{v.x*=.985;v.z=.045+(v.z-.045)*.975;}inner.set(id,push(v,skin[id]));}return inner.get(id);}
for(const{a,b,count}of edges.values())if(count===1){if(Math.abs(vertices[a].p.y-neck)<1e-5&&Math.abs(vertices[b].p.y-neck)<1e-5){const ta=top(a),tb=top(b);quad(b,a,ta,tb);quad(tb,ta,rim(ta),rim(tb));}else quad(b,a,rim(a),rim(b));}
const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(positions.flatMap(v=>v.toArray()),3));shell.setIndex(indices);bindGeometry(shell,(_,i)=>Array.from({length:4},(_,k)=>skin[i][k]??[0,0]));
const meshes=[];
function attach(geometry,name,color,metalness=0){const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({color,roughness:.9,metalness,side:T.DoubleSide}));mesh.name=`Apparel_stand-collar_${name}`;body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);meshes.push(mesh);return mesh;}
attach(shell,'cloth','#58636c');
const surface=new T.Mesh(shell,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.updateMatrixWorld();const ray=new T.Raycaster();
function front(x,y){ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));return ray.intersectObject(surface)[0]?.point.z??.36;}
const detailWeights=v=>binding.front(v.x,v.y).weights;
// Retain the reference's four brass buttons and two lower flap pockets.
const buttons=[],pockets=[];
for(const [number,part]of [5,6,7,8].entries()){
 const geometry=await compactGeometry(source,parts[part].ids);geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3()),size=geometry.boundingBox.getSize(new T.Vector3()),y=[3.145,2.88,2.615,2.35][number],scale=.054/Math.max(size.x,size.y),a=geometry.attributes.position;
 for(let i=0;i<a.count;i++)a.setXYZ(i,(a.getX(i)-center.x)*scale,y+(a.getY(i)-center.y)*scale,front(0,y)+.018+(a.getZ(i)-center.z)*scale);
 bindGeometry(geometry,detailWeights);buttons.push(geometry);
}
for(const part of [9,10]){const geometry=await compactGeometry(source,parts[part].ids),a=geometry.attributes.position;geometry.computeBoundingBox();const z0=geometry.boundingBox.min.z;for(let i=0;i<a.count;i++){const x=a.getX(i)*5.3,y=2.39+a.getY(i)*5.3;a.setXYZ(i,x,y,front(x,y)+.011+(a.getZ(i)-z0)*2.0);}bindGeometry(geometry,detailWeights);pockets.push(geometry);}
attach(mergeGeometries(buttons,false),'buttons','#c9b793',.12);attach(mergeGeometries(pockets,false),'pockets','#58636c');
const triangles=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0);
const meta={id:'stand-collar',label:'立领制服上衣',slot:'top',asset:'stand-collar-rig.glb',prefix:'Apparel_',triangles,drawCalls:meshes.length,source:sourcePath,bodySource:'wardrobe-current-body.glb',bodyBones:body.skeleton.bones.length,revision:'straight-uniform-0920-1',status:'reconstructed-tryon',open:false,sleeveless:false,accessory:false,head:false};
root.userData.apparel=meta;const output='output/cardigan-controller/clothing-0920b';await fs.mkdir(output,{recursive:true});root.updateMatrixWorld(true);body.skeleton.update();await saveGlb(root,`${output}/stand-collar-rig.glb`);
const only=new T.Group();for(const mesh of meshes){const geometry=mesh.geometry.clone();geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');const plain=new T.Mesh(geometry,mesh.material);plain.name=mesh.name;only.add(plain);}await saveGlb(only,`${output}/stand-collar-only.glb`);
for(const kind of ['rig','only'])await fs.copyFile(`${output}/stand-collar-${kind}.glb`,`public/room3d/wardrobe/stand-collar-${kind}.glb`);
await fs.writeFile(`${output}/stand-collar-manifest.json`,JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));
