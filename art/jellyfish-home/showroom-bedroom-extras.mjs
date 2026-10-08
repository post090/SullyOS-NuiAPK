import fs from 'node:fs/promises';import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import {readGeometry,compactGeometry,splitParts,saveGlb} from './asset-geometry.mjs';
await MeshoptSimplifier.ready;
const dir='art/jellyfish-home/sources/showrooms/';
const parts=[
 {key:'plant-large',bounds:[[.565,-.452,-.62],[.865,.14,-.33]],keep:(x,y,z)=>y>-.30||Math.hypot(x-.715,z+.47)<.077},
 {key:'plant-small',bounds:[[-.90,-.452,.51],[-.635,-.08,.82]]},
];
async function reduce(g,target){if(g.index.count<=target*3)return g;const [ix]=MeshoptSimplifier.simplify(new Uint32Array(g.index.array),g.attributes.position.array,3,target*3,.10,['Permissive']);return compactGeometry(g,ix);}
if(process.argv.includes('--extract')){
 const g=mergeGeometries(await readGeometry('output/showroom-source/6.glb')),p=g.attributes.position,index=g.index;
 for(const a of parts){const ids=[];for(let k=0;k<index.count;k+=3){const is=[0,1,2].map(j=>index.getX(k+j));if(is.every(i=>{const xyz=[p.getX(i),p.getY(i),p.getZ(i)];return xyz.every((v,j)=>v>=a.bounds[0][j]&&v<=a.bounds[1][j])&&(!a.keep||a.keep(...xyz));}))ids.push(...is);}
  const cut=await reduce(await compactGeometry(g,ids),10000),root=new T.Group();root.add(new T.Mesh(cut,new T.MeshStandardMaterial()));await saveGlb(root,dir+a.key+'.glb');
 }
}
const palette={woodLight:'#ffffff',ceramic:'#e9e0d2',leaf:'#748748',leafLight:'#8fa55c',stem:'#766348',soil:'#685442',mirror:'#bfcdd0',gleam:'#f3f3e9'};
const mats=Object.fromEntries(Object.entries(palette).map(([name,color])=>{const m=new T.MeshStandardMaterial({color,roughness:name==='mirror'?.22:.85,metalness:name==='mirror'?.3:0,side:name.startsWith('leaf')?T.DoubleSide:T.FrontSide});m.name=name;return [name,m];}));mats.woodLight.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),report=[];
const add=(root,g,mat)=>{g.deleteAttribute('uv');root.add(new T.Mesh(g,mats[mat]));};
function box(root,size,at,mat='woodLight',radius=.02){const g=new RoundedBoxGeometry(...size,1,Math.min(radius,...size.map(v=>v/3)));g.translate(...at);add(root,g,mat);}
async function save(root,id,name,surface,paintMaterials,extra={}){
 root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(root),c=b.getCenter(new T.Vector3()),combined=new T.Group(),groups=new Map();
 root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.translate(-c.x,-b.min.y,-c.z);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);});
 for(const [mat,gs]of groups)combined.add(new T.Mesh(mergeVertices(mergeGeometries(gs.map(g=>g.index?g.toNonIndexed():g))),mat));
 const s=new T.Box3().setFromObject(combined).getSize(new T.Vector3()).toArray();let triangles=0;combined.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});if(triangles>=4000)throw Error(id+' budget '+triangles);
 const a={id,name,surface,collection:'bedroom',url:id+'.glb',revision:'bedroom-extras-2',size:s,default:[0,.15,0],boxes:[[-s[0]/2,0,-s[2]/2,s[0]/2,s[1],s[2]/2]],paintMaterials,...extra};const old=catalog.findIndex(a=>a.id===id);if(old<0)catalog.push(a);else catalog[old]=a;
 const bytes=await saveGlb(combined,'public/room3d/'+id+'.glb');report.push({id,triangles,bytes,size:s});
}
for(const [key,id,name,height,surface]of [['plant-large','suite_plant_large','奶油盆大叶绿植',1.95,'floor'],['plant-small','suite_plant_small','奶油盆小绿植',.56,'tabletop']]){
 const large=key==='plant-large',source=mergeGeometries(await readGeometry(dir+key+'.glb')),p=source.attributes.position;
 const component=splitParts(source)[0],ids=[];
 for(let k=0;k<component.ids.length;k+=3){
  const tri=component.ids.slice(k,k+3);
  if(tri.every(i=>{const x=p.getX(i),y=p.getY(i),z=p.getZ(i);return large?y>-.31&&(y>-.22||z<-.415):y>-.29&&(y>-.268||Math.hypot(x+.795,z-.63)<.033);}))ids.push(...tri);
 }
 let g=await reduce(await compactGeometry(source,ids),2350);
 g.computeBoundingBox();const b=g.boundingBox,c=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3()),potHeight=height*.24,scale=(height-potHeight*.84)/s.y;
 // Keep the original leaves; remove fused furniture and rebuild only the closed pot.
 g.translate(-c.x,-b.min.y,-c.z);g.scale(scale,scale,scale);g.translate(0,potHeight*.84,0);g.computeVertexNormals();
 const root=new T.Group();add(root,g,'leaf');
 const radius=height*(large?.15:.205),profile=[[0,0],[radius*.72,0],[radius*.83,.018*height],[radius*.98,potHeight*.86],[radius,potHeight*.96],[radius*.96,potHeight],[radius*.86,potHeight],[radius*.85,potHeight*.86],[0,potHeight*.84]].map(([x,y])=>new T.Vector2(x,y));
 add(root,new T.LatheGeometry(profile,32),'ceramic');
 const soil=new T.CylinderGeometry(radius*.84,radius*.84,.012*height,32);soil.translate(0,potHeight*.87,0);add(root,soil,'soil');
 await save(root,id,name,surface,['ceramic'],surface==='floor'?{waterable:true}:{contact:{width:radius*2,depth:radius*2}});
}
{
 const root=new T.Group();
 // The original oval rim is fused with the room wall. Repair its silhouette with
 // an oval rounded frame, retaining the source proportions without wall scraps.
 const rim=new T.TorusGeometry(1,.064,8,64);rim.scale(.43,.54,.55);rim.translate(0,.66,0);add(root,rim,'woodLight');
 const glass=new T.CircleGeometry(1,64);glass.scale(.414,.52,1);glass.translate(0,.66,.010);add(root,glass,'mirror');
 const back=new T.CircleGeometry(1,64);back.scale(.43,.54,1);back.rotateY(Math.PI);back.translate(0,.66,-.032);add(root,back,'woodLight');
 const shine=new T.TorusGeometry(1,.009,4,32,Math.PI*.6);shine.scale(.375,.48,1);shine.rotateZ(.20);shine.translate(0,.66,.014);add(root,shine,'gleam');
 box(root,[.09,.20,.07],[0,.11,0]);box(root,[.72,.065,.31],[0,.0325,0]);await save(root,'suite_dressing_mirror','暖木椭圆梳妆镜','tabletop',['woodLight']);
}
{
 const root=new T.Group(),frame=new T.Group(),w=1.24,h=2.50,r=w/2;
 const outline=(inset=0)=>{const shape=new T.Shape(),R=r-inset;shape.moveTo(-R,inset);shape.lineTo(R,inset);shape.lineTo(R,h-r);shape.absarc(0,h-r,R,0,Math.PI,false);shape.closePath();return shape;};
 const ring=outline(),hole=outline(.055);ring.holes.push(new T.Path(hole.getPoints(32).reverse()));
 const g=new T.ExtrudeGeometry(ring,{depth:.065,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.013,bevelThickness:.012,curveSegments:24});g.translate(0,.035,-.045);add(frame,g,'woodLight');
 const glass=new T.ShapeGeometry(outline(.06),32);glass.translate(0,.035,.025);add(frame,glass,'mirror');
 box(frame,[.018,1.5,.006],[-.40,1.20,.030],'gleam',.002);
 frame.rotation.x=-.07;root.add(frame);box(root,[1.32,.065,.48],[0,.033,-.03]);
 for(const x of [-.49,.49])box(root,[.045,1.65,.045],[x,.85,-.25]);
 await save(root,'suite_floor_mirror','暖木拱顶穿衣镜','floor',['woodLight']);
}
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');await fs.writeFile(dir+'bedroom-extras-report.json',JSON.stringify(report,null,2)+'\n');console.log(report);
