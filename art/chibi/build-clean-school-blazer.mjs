import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surfaceBinding,bindGeometry} from './clothing-details.mjs';
import {naturalBlazerShell} from './natural-blazer-shell.mjs';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';

// Independent from the shirt helper: this is only the outer jacket, with its
// own notch lapels, pockets and buttons. There is no shirt front or necktie.
const output='output/cardigan-controller/clothing-0920b';
const bytes=await fs.readFile('output/clothing-rebuild-0920/wardrobe-current-body.glb');
const root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
root.updateMatrixWorld(true);
const body=root.getObjectByName('Mesh_0'),{shell,envelope}=naturalBlazerShell(body),meshes=[];
const garmentBinding=surfaceBinding({geometry:envelope,skeleton:body.skeleton});
function frontAt(x,y){return garmentBinding.front(x,y,0).point.z;}
const front=y=>frontAt(0,y),lerp=T.MathUtils.lerp;
function torsoWeights(p){return garmentBinding.front(p.x,p.y,0).weights;}
function attach(geometry,name,color){const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide}));mesh.name='Apparel_school-blazer_'+name;body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);meshes.push(mesh);return mesh;}
attach(shell,'cloth','#667584');

function panel(points,offset=.012,depth=.010,matchedEdge=false){
 const contour=points.map(([x,y])=>new T.Vector2(x,y)),faces=T.ShapeUtils.triangulateShape(contour,[]),positions=[],normals=[],indices=[];
 const height=(x,y)=>frontAt(x,y)+offset+(matchedEdge?.018*T.MathUtils.smoothstep(y,3.28,3.36):0);
 function vertex(p,z,normal){const i=positions.length/3;positions.push(p.x,p.y,height(p.x,p.y)+z);normals.push(...normal.toArray());return i;}
 function normalAt(p,sign){const e=.0001,surface=matchedEdge?height:frontAt,n=new T.Vector3(-(surface(p.x+e,p.y)-surface(p.x-e,p.y))/(2*e),-(surface(p.x,p.y+e)-surface(p.x,p.y-e))/(2*e),1);return n.normalize().multiplyScalar(sign);}
 const n=matchedEdge?6:4;
 for(const face of faces){const[a,b,c]=face.map(i=>contour[i]),point=(i,j)=>a.clone().addScaledVector(b.clone().sub(a),i/n).addScaledVector(c.clone().sub(a),j/n);
  // The lapel material is double-sided: keep one cloth surface with a tiny
  // turned edge, rather than two nearly coincident caps at its body join.
  for(const[z,sign]of(matchedEdge?[[depth,1]]:[[0,-1],[depth,1]]))for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
   const tri=(v1,v2,v3)=>{const ids=[v1,v2,v3].map(p=>vertex(p,z,normalAt(p,sign)));indices.push(...(sign>0?ids:ids.reverse()));};
   tri(point(i,j),point(i+1,j),point(i,j+1));if(i+j<n-1)tri(point(i+1,j),point(i+1,j+1),point(i,j+1));
  }
 }
 for(let i=0;i<contour.length;i++){
  const a=contour[i],b=contour[(i+1)%contour.length],normal=new T.Vector3(b.y-a.y,a.x-b.x,0).normalize(),segments=matchedEdge?n:1;
  // The lapel follows the curved body surface. Its narrow turned edge must
  // use the same subdivisions as the face, rather than bridging only its
  // endpoints and leaving a dark wedge behind the curved face.
  for(let k=0;k<segments;k++){const p=a.clone().lerp(b,k/segments),q=a.clone().lerp(b,(k+1)/segments),ids=[vertex(p,0,normal),vertex(q,0,normal),vertex(q,depth,normal),vertex(p,depth,normal)];indices.push(ids[0],ids[1],ids[3],ids[1],ids[2],ids[3]);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);bindGeometry(g,torsoWeights);g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return g;
}
const pp=[],pi=[];
for(let i=0;i<=8;i++){const y=lerp(2.16,2.745,i/8);for(const x of [-.008,.008])pp.push(x,y,front(y)+.006);if(i)pi.push((i-1)*2,(i-1)*2+1,i*2,(i-1)*2+1,i*2+1,i*2);}
const placket=new T.BufferGeometry();placket.setAttribute('position',new T.Float32BufferAttribute(pp,3));placket.setIndex(pi);bindGeometry(placket,torsoWeights);

// The reference's pronounced suit lapel notch and lower pocket flaps.
const lapels=[],pockets=[];
for(const sign of [-1,1]){
 const coords=pts=>pts.map(([x,y])=>[sign*x,y]);
 lapels.push(panel(coords([[.158,3.379],[.306,3.261],[.249,3.201],[.329,3.172],[.032,2.734],[.126,3.157]]),.010,.003,true));
 // A small internal facing joins the actual inner lapel edge to the neck
 // opening. Matching its existing edge samples and skin weights closes the
 // white slit visible from 45 degrees without covering the central V.
 const joinPos=[],joinIdx=[];
 for(let k=4;k<=6;k++){
  const t=k/6,y=lerp(3.157,3.379,t),outerX=sign*lerp(.126,.158,t),innerX=sign*(lerp(.245*(y-2.76),.128,T.MathUtils.smoothstep(y,3.36,3.405))+.001);
  joinPos.push(innerX,y,frontAt(innerX,y)+.001,outerX,y,frontAt(outerX,y)+.013+.018*T.MathUtils.smoothstep(y,3.28,3.36)-.0002);
  if(k>4){const i=(k-5)*2;joinIdx.push(i,i+1,i+2,i+1,i+3,i+2);}
 }
 // Continue the same thin facing above the lapel tip to meet the smoothed
 // neck rim, so looking down from 45 degrees cannot see a triangular slit.
 const rimY=3.404,rimInner=sign*(lerp(.245*(rimY-2.76),.128,T.MathUtils.smoothstep(rimY,3.36,3.405))+.001),rimOuter=sign*.135;
 joinPos.push(rimInner,rimY,frontAt(rimInner,rimY)+.001,rimOuter,rimY,frontAt(rimOuter,rimY)+.002);joinIdx.push(4,5,6,5,7,6);
 const join=new T.BufferGeometry();join.setAttribute('position',new T.Float32BufferAttribute(joinPos,3));join.setIndex(joinIdx);bindGeometry(join,torsoWeights);lapels.push(join);
 pockets.push(panel(coords([[.146,2.446],[.401,2.446],[.392,2.379],[.150,2.379]]),.017,.010));
}
// Small breast pocket at the same side as the source reference.
pockets.push(panel([[.217,3.02],[.350,3.02],[.345,2.958],[.279,2.913],[.220,2.959]],.013,.010));
attach(mergeGeometries(pockets,false),'pocket-flaps-and-breast-pocket','#6d7b89');
attach(mergeGeometries([...lapels,placket],false),'notched-lapels','#586979');

const buttons=[];
for(const y of [2.37,2.64]){const g=new T.SphereGeometry(.020,10,5);g.scale(1,1,.40);g.translate(0,y,front(y)+.020);bindGeometry(g,torsoWeights);buttons.push(g);}
attach(mergeGeometries(buttons,false),'buttons','#9a9d98');
const triangles=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0);
root.userData.apparel={id:'school-blazer',label:'翻领西装外套',source:'Meshy_AI_Blank_Slate_Professio_0920125755_generate.glb',method:'current 48-bone body surface, continuous close shoulders, gradually flared sleeves; jacket only with real V opening',triangles,status:'authored-tryon',open:true,sleeveless:false};
root.updateMatrixWorld(true);body.skeleton.update();
await fs.mkdir(output,{recursive:true});await saveGlb(root,output+'/school-blazer-rig.glb');
const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,output+'/school-blazer-only.glb');
await fs.copyFile(output+'/school-blazer-rig.glb','public/room3d/wardrobe/school-blazer-rig.glb');
const report={triangles,drawCalls:meshes.length,vertices:shell.attributes.position.count,meshes:meshes.map(m=>({name:m.name,triangles:m.geometry.index.count/3,color:m.material.color.getHexString()})),bones:body.skeleton.bones.length};
await fs.writeFile('output/clothing-rebuild-0920/blazer-natural/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
