import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';

// Keep the already fitted white ruffles. The generated source omitted the
// central fabric ribbon entirely; add a real, head-bound ribbon, not a decal.
const directory='output/cardigan-controller/clothing-0920b';
const backup='output/wardrobe-rebuild-0920/headband-before';
await fs.mkdir(backup,{recursive:true});
for(const kind of ['rig','only']){
  const path=`${backup}/bow-headband-${kind}.glb`;
  try{await fs.access(path);}catch{await fs.copyFile(`${directory}/bow-headband-${kind}.glb`,path);}
}
const bytes=await fs.readFile(`${backup}/bow-headband-rig.glb`);
const root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
root.updateMatrixWorld(true);
const original=root.getObjectByName('Apparel_bow-headband_0');
if(!original?.isSkinnedMesh)throw Error('Missing fitted headband mesh');
const body=root.getObjectByName('Mesh_0');
const skeleton=original.skeleton,head=skeleton.bones.findIndex(b=>b.name==='head');
if(head<0||!body?.isSkinnedMesh)throw Error('Missing head or reference body');
const parts=splitParts(original.geometry);
if(parts.length!==6)throw Error('Unexpected headband topology');
const whiteParts=parts.filter(p=>p.box.min.x<0&&p.box.max.x>0);
const blackParts=parts.filter(p=>!whiteParts.includes(p));
const white=await compactGeometry(original.geometry,whiteParts.flatMap(p=>p.ids));
const bows=await compactGeometry(original.geometry,blackParts.flatMap(p=>p.ids));

// Radial projection follows the actual doll head, preventing the new strip
// disappearing inside it. The original flared ruffle tips retain their shape.
const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3();
const bodyMaterial=body.material;
body.material=new T.MeshBasicMaterial({side:T.DoubleSide});
body.skeleton.update();
function surfaceAt(theta,z,clearance=.015){
  origin.set(0,4.06,z);direction.set(Math.sin(theta),Math.cos(theta),0);
  ray.set(origin,direction);ray.far=1.2;
  const hit=ray.intersectObject(body)[0];
  if(!hit)throw Error(`Head surface missing at ${theta}/${z}`);
  return origin.clone().addScaledVector(direction,hit.distance+clearance);
}
const p=white.attributes.position;let lifted=0;
for(let i=0;i<p.count;i++){
  const v=new T.Vector3().fromBufferAttribute(p,i),theta=Math.atan2(v.x,v.y-4.06);
  const min=surfaceAt(theta,v.z,.013);
  if(Math.hypot(v.x,v.y-4.06)<Math.hypot(min.x,min.y-4.06)){
    p.setXYZ(i,min.x,min.y,min.z);lifted++;
  }
}
white.computeVertexNormals();
const positions=[],indices=[],segments=48,rows=4;
for(let i=0;i<=segments;i++)for(let row=0;row<=rows;row++){
  const theta=-1.27+2.54*i/segments;
  const taper=.76+.24*Math.cos(theta);
  const z=.061+((row/rows)-.5)*.183*taper;
  positions.push(...surfaceAt(theta,z,.024).toArray());
}
for(let i=0;i<segments;i++)for(let row=0;row<rows;row++){
  const a=i*(rows+1)+row,b=a+rows+1;indices.push(a,b,a+1,a+1,b,b+1);
}
const ribbon=new T.BufferGeometry();ribbon.setAttribute('position',new T.Float32BufferAttribute(positions,3));ribbon.setIndex(indices);ribbon.computeVertexNormals();
body.material.dispose();body.material=bodyMaterial;
const black=mergeGeometries([bows,ribbon],false);
const materials=[
  new T.MeshStandardMaterial({name:'maid_white_ruffles',color:'#f2ede7',roughness:.92,side:T.DoubleSide}),
  new T.MeshStandardMaterial({name:'maid_black_ribbon_and_bows',color:'#17171b',roughness:.86,side:T.DoubleSide}),
];
const meshes=[];
for(const[g,i]of [[white,0],[black,1]]){
  const count=g.attributes.position.count,js=new Uint16Array(count*4),ws=new Float32Array(count*4);
  for(let j=0;j<count;j++){js[j*4]=head;ws[j*4]=1;}
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(js,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(ws,4));
  g.computeBoundingBox();g.computeBoundingSphere();
  const mesh=new T.SkinnedMesh(g,materials[i]);mesh.name=`Apparel_bow-headband_${i===0?'white_ruffles':'black_ribbon'}`;
  original.parent.add(mesh);mesh.bind(skeleton,original.bindMatrix);meshes.push(mesh);
}
original.removeFromParent();
const report={id:'bow-headband',whiteRuffleTriangles:white.index.count/3,blackBowAndRibbonTriangles:black.index.count/3,ribbonTriangles:ribbon.index.count/3,triangles:(white.index.count+black.index.count)/3,drawCalls:2,liftedRuffleVertices:lifted,binding:'head',materials:materials.map(m=>({name:m.name,color:'#'+m.color.getHexString()}))};
root.userData.apparel={...root.userData.apparel,triangles:report.triangles,drawCalls:2,revision:'maid-black-center-ribbon'};
await saveGlb(root,`${directory}/bow-headband-rig.glb`);
const only=new T.Group();for(const mesh of meshes){const g=mesh.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const m=new T.Mesh(g,mesh.material);m.name=mesh.name;only.add(m);}
await saveGlb(only,`${directory}/bow-headband-only.glb`);
await fs.copyFile(`${directory}/bow-headband-rig.glb`,'public/room3d/wardrobe/bow-headband-rig.glb');
await fs.writeFile('output/wardrobe-rebuild-0920/headband-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
