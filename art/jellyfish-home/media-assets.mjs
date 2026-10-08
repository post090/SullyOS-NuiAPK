// Geometry-based cleanup and hand-painted solid materials; no imported pixels.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeVertices,mergeGeometries,toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from './asset-geometry.mjs';
const mat=(name,color,roughness=.8)=>Object.assign(new T.MeshStandardMaterial({color,roughness}),{name});
const m={wood:mat('woodLight','#ffffff',.65),cream:mat('cream','#fff2e3'),dark:mat('electronics-dark','#4c4e60'),screen:mat('screen','#596d7d',.36),glass:mat('window-blue','#c1d9df',.5),brass:mat('brass','#c4a577',.6),pink:mat('control-pink','#dda5b8'),mint:mat('control-mint','#9cbaa6'),blue:mat('control-blue','#92b4ce'),yellow:mat('control-yellow','#e3c780')};
m.wood.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),report=[];
function add(root,g,material,position=[0,0,0]){g.translate(...position);const o=new T.Mesh(g,material);root.add(o);return o;}
function box(root,w,h,d,r,material,p){return add(root,mergeVertices(new RoundedBoxGeometry(w,h,d,2,r)),material,p);}
async function sourcePart(root,g,part,material){const geo=await compactGeometry(g,part.ids);add(root,mergeVertices(toCreasedNormals(geo,Math.PI/4)),material);}
async function emit(id,name,root,width,surface,extra={}){
 root.updateMatrixWorld(true);const buckets=new Map();root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);});
 const result=new T.Group();for(const [material,geos]of buckets)result.add(new T.Mesh(mergeGeometries(geos),material));
 const b=new T.Box3().setFromObject(result),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=width/size.x;
 result.traverse(o=>{if(o.isMesh)o.geometry.translate(-center.x,-b.min.y,-center.z).scale(scale,scale,scale);});size.multiplyScalar(scale);
 const bytes=await saveGlb(result,`public/room3d/${id}.glb`),a={id,name,surface,url:`${id}.glb`,size:size.toArray(),default:[0,.15,0],boxes:[[-size.x/2,0,-size.z/2,size.x/2,size.y,size.z/2]],...extra};
 const index=catalog.findIndex(a=>a.id===id);if(index<0)catalog.push(a);else catalog[index]=a;let triangles=0;result.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});report.push({id,bytes,triangles,size:a.size});return a;
}
const [windowGeo]=await readGeometry('art/jellyfish-home/sources/wooden-window-geometry.glb'),windowRoot=new T.Group();
for(const part of splitParts(windowGeo)){
 const size=part.box.getSize(new T.Vector3());
 // Thin six-triangle panes are the only glass; frame/rails keep the wood color.
 const glass=part.count===6&&size.z<.005,handle=part.count<250&&!glass;
 if(glass&&part.center.z<0)continue;
 await sourcePart(windowRoot,windowGeo,part,glass?m.glass:handle?m.brass:m.wood);
}
// Opaque frosted panes avoid rendering the solid room wall through the glass.
await emit('wooden_window','原木四格窗',windowRoot,1.75,'wall',{default:[0,1.8,-2.39],paintMaterials:['woodLight']});
const legacyWindow=catalog.findIndex(a=>a.id==='wooden_window_left');if(legacyWindow>=0)catalog.splice(legacyWindow,1);
const [nook]=await readGeometry('art/jellyfish-home/sources/gaming-nook-geometry.glb'),parts=splitParts(nook),byId=new Map(parts.map(p=>[p.id,p]));
const cabinet=new T.Group(),tv=new T.Group();
// Reviewed connected surfaces from the fixed geometry-only source. Remove the
// old controller, player, books and boxes; do not bake them into the cabinet.
const cabinetMaterials=new Map([[1015,m.wood],[507,m.cream],[625,m.cream],[958,m.brass],[874,m.brass],[863,m.wood],[1046,m.wood],[977,m.wood],[939,m.wood]]);
const tvMaterials=new Map([[841,m.dark],[1002,m.screen],[928,m.dark],[493,m.dark],[885,m.dark]]);
for(const [id,material]of cabinetMaterials){assert.ok(byId.has(id));await sourcePart(cabinet,nook,byId.get(id),material);}
for(const [id,material]of tvMaterials){assert.ok(byId.has(id));await sourcePart(tv,nook,byId.get(id),material);}
// The imported top is very slightly uneven. A closed wood cap gives separate
// objects a true flat support plane without changing the front cabinet design.
box(cabinet,.991,.018,.298,.006,m.wood,[.001,-.109,-.01]);
const cab=await emit('media_cabinet','原木电视柜',cabinet,3.4,'floor',{default:[0,.15,-1.7],paintMaterials:['cream']});
cab.support={shape:'rect',width:3.25,depth:.90,height:cab.size[1]};
await emit('small_television','小电视',tv,2.55,'tabletop',{paintMaterials:['electronics-dark']});
// Original replacement: quiet rounded shell, cartridge slot, vents and a small
// status dot. No manufacturer logo and no image textures.
const consoleRoot=new T.Group();
box(consoleRoot,.46,.055,.29,.018,m.dark,[0,.0275,0]);
box(consoleRoot,.44,.24,.265,.025,m.cream,[0,.155,-.006]);
box(consoleRoot,.265,.014,.008,.004,m.dark,[-.04,.205,.130]);
for(let i=0;i<5;i++)box(consoleRoot,.022,.004,.09,.0015,m.dark,[-.105+i*.047,.277,-.006]);
box(consoleRoot,.027,.027,.009,.009,m.mint,[.16,.092,.131]);
box(consoleRoot,.036,.009,.009,.002,m.dark,[-.16,.075,.131]);
box(consoleRoot,.036,.009,.009,.002,m.dark,[-.10,.075,.131]);
await emit('little_console','奶油游戏主机',consoleRoot,.48,'tabletop',{paintMaterials:['cream']});
const controller=new T.Group(),shell=new T.Shape();
shell.moveTo(-.145,.07);shell.bezierCurveTo(-.16,.085,-.185,.07,-.19,.035);shell.lineTo(-.205,-.065);shell.bezierCurveTo(-.20,-.11,-.155,-.115,-.125,-.065);shell.lineTo(-.075,-.025);shell.quadraticCurveTo(0,-.045,.075,-.025);shell.lineTo(.125,-.065);shell.bezierCurveTo(.155,-.115,.20,-.11,.205,-.065);shell.lineTo(.19,.035);shell.bezierCurveTo(.185,.07,.16,.085,.145,.07);shell.closePath();
const shellGeo=new T.ExtrudeGeometry(shell,{depth:.045,bevelEnabled:true,bevelSegments:3,bevelSize:.007,bevelThickness:.007,curveSegments:8});
add(controller,mergeVertices(toCreasedNormals(shellGeo,Math.PI/3)),m.cream);
function button(x,y,r,material){const g=new T.CylinderGeometry(r,r,.008,12);g.rotateX(Math.PI/2);add(controller,g,material,[x,y,.057]);}
box(controller,.045,.014,.009,.003,m.dark,[-.128,.032,.057]);box(controller,.014,.045,.010,.003,m.dark,[-.128,.032,.058]);
button(-.062,-.007,.021,m.dark);button(.060,-.007,.021,m.dark);
for(const [x,y,color]of [[.128,.052,m.mint],[.15,.03,m.pink],[.128,.008,m.blue],[.106,.03,m.yellow]])button(x,y,.009,color);
box(controller,.012,.004,.007,.001,m.dark,[-.026,.044,.055]);box(controller,.012,.004,.007,.001,m.dark,[.026,.044,.055]);
controller.rotation.x=-Math.PI/3;
await emit('little_controller','四色小手柄',controller,.40,'tabletop',{paintMaterials:['cream']});
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify(report,null,2));
