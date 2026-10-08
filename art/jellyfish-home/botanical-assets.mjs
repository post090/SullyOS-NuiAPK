// All decisions use geometry, never imported image colors. See furniture asset protocol.
import fs from 'node:fs/promises';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeVertices,mergeGeometries,toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from './asset-geometry.mjs';
const solid=(name,color)=>Object.assign(new T.MeshStandardMaterial({color,roughness:.82,side:T.DoubleSide}),{name});
const wood=solid('woodLight',0xffffff);wood.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);wood.roughness=.65;
const mats={wood,cream:solid('cream','#fff2e3'),leaf:solid('leaf','#71986b'),stem:solid('stem','#53734c'),soil:solid('soil','#665345'),pink:solid('pink','#deb0bb'),yellow:solid('yellow','#eac976'),pages:solid('pages','#f7ead7'),book:solid('book','#a9b2cf'),cookie:solid('cookie','#d2a16d'),tea:solid('tea','#926847')};
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8'));
const emitted=[];
async function emit(id,name,root,width,surface,extra={}){
 root.traverse(o=>{if(o.isMesh)o.geometry.deleteAttribute('uv');});
 const buckets=new Map();for(const o of [...root.children]){if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o.geometry);root.remove(o);}for(const [m,geos]of buckets)root.add(new T.Mesh(mergeGeometries(geos),m));
 const b=new T.Box3().setFromObject(root),s=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=width/s.x;
 root.traverse(o=>{if(o.isMesh)o.geometry.translate(-center.x,-b.min.y,-center.z).scale(scale,scale,scale);});
 const size=s.multiplyScalar(scale).toArray(),bytes=await saveGlb(root,`public/room3d/${id}.glb`);let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});
 const a={id,name,surface,url:`${id}.glb`,size,default:[0,.15,0],boxes:[[-size[0]/2,0,-size[2]/2,size[0]/2,size[1],size[2]/2]],...extra};
 const at=catalog.findIndex(a=>a.id===id);if(at<0)catalog.push(a);else catalog[at]=a;emitted.push({id,bytes,triangles,size});return a;
}
function filter(g,predicate){const p=g.attributes.position,ids=[];for(let i=0;i<g.index.count;i+=3){const t=[0,1,2].map(k=>g.index.getX(i+k)),v=new T.Vector3();for(const j of t)v.add(new T.Vector3().fromBufferAttribute(p,j));v.divideScalar(3);if(predicate(v,t,p))ids.push(...t);}return ids;}
async function mesh(root,g,ids,material,target=2500){if(ids.length)root.add(new T.Mesh(await compactGeometry(g,ids,target),material));}
const [plant]=await readGeometry('art/jellyfish-home/sources/monstera-geometry.glb'),plantRoot=new T.Group();
for(const part of splitParts(plant)){
 if(part.box.min.y<-.49){await mesh(plantRoot,plant,part.ids,mats.cream);}
 else await mesh(plantRoot,plant,part.ids,part.box.min.y<-.17&&part.count<100?mats.stem:mats.leaf);
}
const soil=new T.Mesh(new T.CylinderGeometry(.135,.135,.018,24),mats.soil);soil.geometry.translate(-.024,-.204,.002);plantRoot.add(soil);
await emit('monstera','龟背竹',plantRoot,1.08,'floor',{waterable:true});
const [table]=await readGeometry('art/jellyfish-home/sources/daisy-table-geometry.glb'),tableRoot=new T.Group();
await mesh(tableRoot,table,filter(table,v=>v.y<-.26),wood,1800);
// Relax the imported leg surface without subdivision or cumulative shrinking.
const legs=tableRoot.children[0].geometry,lp=legs.attributes.position,neighbors=Array.from({length:lp.count},()=>new Set());
for(let i=0;i<legs.index.count;i+=3){const t=[0,1,2].map(k=>legs.index.getX(i+k));for(const a of t)for(const b of t)if(a!==b)neighbors[a].add(b);}
legs.computeBoundingBox();const legBounds=legs.boundingBox.clone();
for(let pass=0;pass<12;pass++){const old=lp.array.slice(),factor=pass%2?-.53:.5;for(let i=0;i<lp.count;i++)for(let axis=0;axis<3;axis++){let avg=0;for(const j of neighbors[i])avg+=old[j*3+axis];if(neighbors[i].size)lp.array[i*3+axis]=old[i*3+axis]+factor*(avg/neighbors[i].size-old[i*3+axis]);}}
legs.computeBoundingBox();const relaxed=legs.boundingBox.clone(),before=legBounds.getSize(new T.Vector3()),after=relaxed.getSize(new T.Vector3());
for(let i=0;i<lp.count;i++)for(let axis=0;axis<3;axis++)lp.array[i*3+axis]=legBounds.min.getComponent(axis)+(lp.array[i*3+axis]-relaxed.min.getComponent(axis))*before.getComponent(axis)/after.getComponent(axis);
// The source was cut through triangles, leaving uneven open leg rims. Extend
// every rim into the slab and cap it; global bounds alone cannot fix each leg.
const legEdges=new Map();for(let i=0;i<legs.index.count;i+=3){const t=[0,1,2].map(k=>legs.index.getX(i+k));for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const edge=legEdges.get(key);if(edge)edge.count++;else legEdges.set(key,{a,b,count:1});}}
const rims=[...legEdges.values()].filter(e=>e.count===1),rimVertices=new Set(rims.flatMap(e=>[e.a,e.b]));
for(const i of rimVertices){if(lp.getY(i)<-.42)throw Error('Unexpected open leg surface below the joint');lp.setY(i,-.19);}
const legPositions=Array.from(lp.array),legIndices=Array.from(legs.index.array);
for(const part of splitParts(legs)){const members=new Set(part.ids),edges=rims.filter(e=>members.has(e.a)),vertices=[...new Set(edges.flatMap(e=>[e.a,e.b]))];if(!vertices.length)continue;const center=new T.Vector3();for(const i of vertices)center.add(new T.Vector3().fromBufferAttribute(lp,i));center.divideScalar(vertices.length);const cap=legPositions.length/3;legPositions.push(...center.toArray());for(const {a,b}of edges)legIndices.push(b,a,cap);}
legs.setAttribute('position',new T.Float32BufferAttribute(legPositions,3));legs.setIndex(legIndices);legs.deleteAttribute('normal');
legs.computeVertexNormals();legs.computeBoundingBox();
// Rebuild a closed, clear tabletop from the original six-petal silhouette.
const p=table.attributes.position,radii=new Array(120).fill(0);for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<-.23||y>-.045)continue;const x=p.getX(i),z=p.getZ(i),a=(Math.atan2(z,x)+Math.PI*2)%(Math.PI*2),k=Math.floor(a/(Math.PI*2)*120);radii[k]=Math.max(radii[k],Math.hypot(x,z));}
let outline=radii.map((r,i)=>Math.max(r,radii[(i+119)%120],radii[(i+1)%120]));
// Remove radial sampling steps before interpolation; adding vertices alone
// would preserve the old little dents along the petal edges.
for(let pass=0;pass<2;pass++)outline=outline.map((_,i)=>[1,3,6,8,6,3,1].reduce((sum,w,k)=>sum+w*outline[(i+k-3+120)%120],0)/28);
const curve=new T.CatmullRomCurve3(outline.map((r,i)=>new T.Vector3(r*Math.cos(i/120*Math.PI*2),0,r*Math.sin(i/120*Math.PI*2))),true,'centripetal');
const shape=new T.Shape();curve.getPoints(160).forEach((v,i)=>{if(!i)shape.moveTo(v.x,-v.z);else shape.lineTo(v.x,-v.z);});shape.closePath();
// A wider four-segment round-over, with the same top and underside heights.
const top=new T.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:4,steps:1});top.rotateX(-Math.PI/2);top.translate(0,-.225,0);tableRoot.add(new T.Mesh(mergeVertices(toCreasedNormals(top,Math.PI/4)),mats.cream));
// Preserve the approved footprint and support height in existing room saves.
const tableSize=new T.Box3().setFromObject(tableRoot).getSize(new T.Vector3()),tableScale=2.15/tableSize.x;
tableRoot.traverse(o=>{if(o.isMesh)o.geometry.scale(1,.6734570497729311/(tableSize.y*tableScale),1.9618910089954986/(tableSize.z*tableScale));});
const a=await emit('daisy_table','雏菊小桌',tableRoot,2.15,'floor');a.support={shape:'circle',radius:.76,height:a.size[1]};
const decor=await compactGeometry(table,filter(table,(v,t,p)=>t.every(j=>p.getY(j)>-.025)));
const parts=splitParts(decor),vasePart=parts.find(p=>p.box.max.x<0),teaParts=parts.filter(p=>p!==vasePart),vase=new T.Group();
if(!vasePart)throw Error('Source no longer matches vase split');
const vg=await compactGeometry(decor,vasePart.ids);
for(const [mat,pred] of [[mats.cream,v=>v.y<.20],[mats.stem,v=>v.y>=.20&&v.y<.42],[mats.yellow,v=>v.y>=.42]])await mesh(vase,vg,filter(vg,pred),mat,1400);
await emit('daisy_vase','雏菊花瓶',vase,.40,'tabletop');
const tg=await compactGeometry(decor,teaParts.flatMap(p=>p.ids));
const dish=v=>v.z>.25&&v.x>.32, cup=v=>!dish(v)&&v.y>.15;
const plate=new T.Group(),books=new T.Group(),mug=new T.Group();
await mesh(plate,tg,filter(tg,v=>dish(v)&&v.y<.012),mats.cream);await mesh(plate,tg,filter(tg,v=>dish(v)&&v.y>=.012),mats.cookie);
await mesh(mug,tg,filter(tg,cup),mats.pink,2000);
// The fused source has no hidden book faces. Rebuild closed page blocks and
// covers instead of leaving holes / cup imprints when the cup is removed.
for(let i=0;i<2;i++)for(const [y,h,w,d,mat]of [[.012,.024,.48,.34,mats.book],[.045,.046,.455,.32,mats.pages],[.078,.02,.48,.34,mats.book]]){
 const g=mergeVertices(new RoundedBoxGeometry(w,h,d,2,.006));g.rotateY(i*.12);g.translate(0,y+i*.088,0);books.add(new T.Mesh(g,mat));
}
await emit('daisy_books','小叠书',books,.48,'tabletop');await emit('daisy_mug','花边茶杯',mug,.28,'tabletop');await emit('daisy_cookies','花朵点心碟',plate,.42,'tabletop');
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify(emitted,null,2));
