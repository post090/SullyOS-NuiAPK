import {furniturePaintMaterials} from '../../apps/room3d/furniturePaint.js';
// Kitchen pack: geometry only; palette is authored by part function, never image sampling.
import fs from 'node:fs/promises';import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices,toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from './asset-geometry.mjs';
const mat=(name,color)=>{const m=new T.MeshStandardMaterial({color,roughness:.8});m.name=name;return m;};
const m={cream:mat('kitchen-cream','#f3eadb'),mint:mat('kitchen-accent','#bdd0b4'),pink:mat('kitchen-pink','#e4bcc6'),white:mat('kitchen-ceramic','#fff7e9'),metal:mat('kitchen-metal','#a8b1b1'),dark:mat('kitchen-dark','#515864'),water:mat('kitchen-water','#a1cbd7'),leaf:mat('kitchen-leaf','#86a080'),food:mat('kitchen-food','#c99665'),fruit:mat('kitchen-fruit','#e5ba77'),wood:mat('woodLight','#fff')};m.wood.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),report=[];
const root=()=>new T.Group(),add=(r,g,mat,role)=>{g.deleteAttribute('uv');const o=new T.Mesh(g,mat);if(role)o.userData.kitchenRole=role;r.add(o);return o;};
function box(r,size,pos,mat,radius=.008,role){const g=mergeVertices(new RoundedBoxGeometry(...size,1,radius));g.translate(...pos);return add(r,g,mat,role);}
async function part(r,g,p,mat,role){const raw=await compactGeometry(g,p.ids);return add(r,mergeVertices(toCreasedNormals(raw,Math.PI/3)),mat,role);}
async function load(i){const gs=await readGeometry('art/jellyfish-home/sources/kitchen-'+i+'-geometry.glb'),g=mergeGeometries(gs);return {g,parts:splitParts(g)};}
async function emit(id,name,r,width,surface='floor',extra={},height){
 r.updateMatrixWorld(true);const buckets=new Map();
 r.traverse(o=>{if(!o.isMesh)return;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');g.deleteAttribute('color');if(!g.index)g=mergeVertices(g);const role=o.userData.kitchenRole||'',key=o.material.name+'/'+role;if(!buckets.has(key))buckets.set(key,{mat:o.material,role,gs:[]});buckets.get(key).gs.push(g);});
 const result=root();for(const {mat,role,gs}of buckets.values())add(result,mergeGeometries(gs),mat,role);
 const b=new T.Box3().setFromObject(result),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),scale=width/size.x,sy=height?height/size.y:scale,point=p=>[(p[0]-c.x)*scale,(p[1]-b.min.y)*sy,(p[2]-c.z)*scale];
 result.traverse(o=>{if(o.isMesh)o.geometry.translate(-c.x,-b.min.y,-c.z).scale(scale,sy,scale);});size.multiply(new T.Vector3(scale,sy,scale));
 // Door meshes retain separate material batches under one hinge each.
 for(const [role,x]of [['fridge-left',-.248],['fridge-right',.248]]){const children=result.children.filter(o=>o.userData.kitchenRole===role);if(!children.length)continue;const pivot=root(),p=point([x,0,.145]);pivot.name=role;pivot.userData.kitchenRole=role;pivot.position.fromArray(p);for(const child of children){delete child.userData.kitchenRole;child.geometry.translate(-p[0],-p[1],-p[2]);pivot.add(child);}result.add(pivot);}
 const bytes=await saveGlb(result,'public/room3d/'+id+'.glb'),a={id,name,surface,url:id+'.glb',size:size.toArray(),default:[0,.15,0],boxes:surface==='wall'?[]:[[-size.x/2,0,-size.z/2,size.x/2,size.y,size.z/2]],paintMaterials:['kitchen-accent'],collection:'kitchen',...extra};
 const names=[];result.traverse(o=>{if(o.isMesh)names.push(o.material.name)});a.paintMaterials=furniturePaintMaterials(a,names);
 const old=catalog.findIndex(a=>a.id===id);if(old<0)catalog.push(a);else catalog[old]=a;let triangles=0;result.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});report.push({id,bytes,triangles,groups:buckets.size,size:a.size});return {a,point,scale,sy};
}
// Pet feeding bowls have their own semantic category.
{const {g,parts}=await load(1),r=root();for(const p of parts)await part(r,g,p,[2176,2032].includes(p.id)?m.white:p.id===2163?m.wood:[2113,1782].includes(p.id)?m.mint:p.center.x<0&&p.center.y>.055?m.food:m.metal);const water=new T.CylinderGeometry(.143,.143,.006,24);water.translate(.202,.068,0);add(r,water,m.water);await emit('pet_bowls','猫耳宠物双碗',r,1.1,'floor',{category:'pets',collection:'pets'});}
{const {g,parts}=await load(2),r=root();for(const p of parts)await part(r,g,p,p.id===1928?m.mint:p.id===1914?m.cream:[1779,1909].includes(p.id)?m.metal:m.cream);await emit('kitchen_bin','猫耳脚踏垃圾桶',r,.52);}
// Split the original dining group into a clean flat table, one repeatable chair,
// and separate vase / napkin-holder props.
let diningTable,diningChair;
{const {g,parts}=await load(3),table=root(),chair=root(),vase=root(),napkins=root(),chairIds=[2142,1903,2144,2123,1513,790,1338,828,2129,2122],tableIds=[2128,1576,2124,2181,2138,1432];
 for(const p of parts){if(chairIds.includes(p.id))await part(chair,g,p,p.id===1903?m.pink:p.id===2142?m.mint:m.wood);else if(tableIds.includes(p.id))await part(table,g,p,m.wood);else if(p.center.y>.07&&Math.abs(p.center.x)<.16)await part(p.center.x<0?vase:napkins,g,p,p.center.x<0?(p.center.y>.16?m.leaf:m.white):m.cream);}
 box(table,[.48,.035,.50],[.01,.058,.006],m.wood,.008);const t=await emit('dining_table','奶油原木餐桌',table,2.30,'floor',{dining:true},1.03);diningTable=t.a;t.a.support={shape:'rect',width:2.18,depth:t.a.size[2]-.12,height:1.03};
 // Precise tabletop and legs keep the knee space open.
 t.a.boxes=[[-1.15,.87,-t.a.size[2]/2,1.15,1.03,t.a.size[2]/2],...parts.filter(p=>[1576,2124,2181,2138].includes(p.id)).map(p=>[...t.point(p.box.min.toArray()),...t.point(p.box.max.toArray())])];
 chair.rotation.y=-Math.atan2(.435546875-.326171875,.055419921875+.000732421875);
 const ch=await emit('dining_chair','猫耳软垫餐椅',chair,1.20,'floor',{paintMaterials:['kitchen-accent','kitchen-pink']},1.43);diningChair=ch.a;
 const cushion=new T.Vector3(-.326171875,-.04150390625,.055419921875).applyAxisAngle(new T.Vector3(0,1,0),chair.rotation.y),seat=ch.point(cushion.toArray());seat[2]+=.22;ch.a.seats=[{id:'center',label:'餐椅',position:seat,rotation:0}];
 // Slots use chair centers; seating/eating uses the calibrated front cushion point.
 const z=t.a.size[2]/2+ch.a.size[2]/2+.025,x=t.a.size[0]/2+ch.a.size[2]/2+.025;t.a.chairSlots=[{id:'front',position:[0,0,z],rotation:180},{id:'back',position:[0,0,-z],rotation:0},{id:'left',position:[-x,0,0],rotation:90},{id:'right',position:[x,0,0],rotation:270}];
 await emit('dining_vase','餐桌小花瓶',vase,.34,'tabletop',{paintMaterials:['kitchen-ceramic']});await emit('dining_napkins','餐桌纸巾架',napkins,.32,'tabletop');
}
// Authored component palettes retain the supplied geometry and its small details.
for(const [i,id,name,width]of [[4,'kitchen_cart','三层厨房推车',1.12],[5,'kitchen_sink','猫耳水槽橱柜',1.95],[6,'kitchen_spice_shelf','调料与挂杯架',1.50],[7,'kitchen_appliance_shelf','厨房电器收纳架',1.35],[8,'kitchen_range','猫耳灶台与烟机',1.95]]){
 const {g,parts}=await load(i),r=root();
 for(const p of parts){const c=p.center,s=p.box.getSize(new T.Vector3());let color=m.cream;
  if(i===4){color=c.y<-.42?m.dark:s.y>.5?m.wood:s.y<.045&&s.x>.28?m.wood:c.y>.35&&c.x<-.10?m.leaf:p.id===2123?m.pink:s.y>.15&&c.y<-.2?m.mint:c.y>.2?m.mint:m.white;}
  if(i===5){color=p.id===2212||[2201,2044,2194].includes(p.id)?m.metal:p.id===2197?m.white:p.id===1841?m.mint:s.x>.25&&s.y<.05?m.wood:c.y>.14&&c.y<.32&&s.x<.10?m.white:s.y>.15&&c.y<-.2?m.mint:m.cream;}
  if(i===6){color=s.x>.5&&s.y<.07?m.wood:p.id===1940?m.pink:[2079,2045,2187].includes(p.id)?m.white:c.x>.12&&c.y>.2&&s.y<.1?m.leaf:c.y<-.15?m.metal:c.y>.3||c.y>0&&c.y<.14?m.mint:m.cream;}
  if(i===7){color=s.x>.3&&s.y<.055?m.wood:s.y>.65?m.wood:c.y>.25&&c.x<-.12?m.leaf:c.y<-.27?m.cream:c.y>-.25&&c.y<-.02&&s.x>.15?m.mint:p.id===1474?m.white:c.y>.32?m.pink:m.cream;}
  if(i===8){color=p.id===1513?m.mint:[2055,1908].includes(p.id)?m.pink:[2010,2056].includes(p.id)?m.white:p.id===367?m.wood:c.y>-.02&&c.y<.18?m.metal:c.y<-.19&&Math.abs(c.x)<.13&&c.z>.12?m.dark:c.y<-.19?m.mint:m.metal;}
  await part(r,g,p,color);
 }
 const out=await emit(id,name,r,width,i===6?'wall':'floor');if(i===6)out.a.default=[0,2.2,0];
}
// Refrigerator: original shaped doors/ears, real hinge groups, hollow liner.
// The original single solid shell is replaced so opening cannot expose a filled block.
{const {g,parts}=await load(9),r=root();
 for(const p of parts){if([2171,2131,2093].includes(p.id))continue;const role=[2127,2113].includes(p.id)?'fridge-left':[2088,2100,2138,2153,2009].includes(p.id)?'fridge-right':undefined;await part(r,g,p,[2113,2100].includes(p.id)?m.metal:[2138,2153,2009].includes(p.id)?m.pink:[2128,2169].includes(p.id)?m.cream:p.center.y<-.46?m.dark:m.mint,role);}
 box(r,[.035,.925,.318],[-.256,0,-.016],m.mint);box(r,[.035,.925,.318],[.256,0,-.016],m.mint);box(r,[.512,.025,.318],[0,.451,-.016],m.mint);box(r,[.512,.025,.318],[0,-.454,-.016],m.mint);box(r,[.49,.90,.022],[0,0,-.164],m.white);
 box(r,[.477,.023,.282],[0,-.10,-.002],m.white);for(const y of [.025,.18,.335])box(r,[.477,.012,.252],[0,y,-.012],m.white,.003);
 for(const [y,h]of [[-.159,.14],[-.344,.208]]){box(r,[.49,h,.028],[0,y,.139],m.mint,.008);box(r,[.18,.016,.026],[0,y+.018,.167],m.cream,.005);}
 for(const [x,role]of [[-.123,'fridge-left'],[.117,'fridge-right']])box(r,[.225,.515,.012],[x,.19,.112],m.white,.003,role);
 for(const [x,y,mat]of [[-.14,.057,m.pink],[-.045,.057,m.cream],[.13,.213,m.mint],[-.12,.369,m.fruit]]){const g=new T.CylinderGeometry(.027,.03,.058,12);g.translate(x,y,-.045);add(r,g,mat);}
 await emit('kitchen_fridge','猫耳双门冰箱',r,1.42,'floor',{appliance:'fridge'});
}
// Empty island countertop; keep cabinet contents, split the original loose props.
{const {g,parts}=await load(10),island=root(),fruit=root(),jar=root();for(const p of parts){if(p.center.y>.28){await part(p.center.x<0?fruit:jar,g,p,p.id===1889?m.white:p.center.x<0?m.fruit:m.pink);continue;}if(p.id===2076)continue;const s=p.box.getSize(new T.Vector3());await part(island,g,p,s.y<.05&&s.x>.4?m.wood:p.center.y<-.33?m.wood:Math.abs(p.center.x)>.46&&s.y>.15?m.pink:p.center.x>.06&&p.center.x<.40&&p.center.z>.10&&p.center.y<0?m.white:p.center.z>.29?m.mint:m.cream);}box(island,[.94,.058,.646],[.03,.253,.002],m.wood,.010);const a=await emit('kitchen_island','原木厨房中岛',island,2.24,'floor',{},1.22);a.a.support={shape:'rect',width:2.01,depth:a.a.size[2]-.13,height:1.22};await emit('kitchen_fruit_bowl','一碗小水果',fruit,.45,'tabletop');await emit('kitchen_cat_jar','猫耳点心罐',jar,.32,'tabletop');}
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('output/kitchen',{recursive:true});await fs.writeFile('output/kitchen/assets-report.json',JSON.stringify(report,null,2));console.log(report);
