import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Regression for the user's straight-leg requirement. The old irregular
// connector changed width and introduced a ring of visible triangular folds.
for(const id of ['tall-boots','lace-midboots']){
 const bytes=await fs.readFile(`output/cardigan-controller/clothing-0920b/${id}-rig.glb`);
 const root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const mesh=root.getObjectByName(`Footwear_${id}_0`),p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
 for(const side of [-1,1]){
  const top=Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)));
  const rings=[.5,.62,.74,.86,top].map(y=>Array.from({length:p.count},(_,i)=>i).filter(i=>Math.sign(p.getX(i))===side&&Math.abs(p.getY(i)-y)<1e-5));
  const bounds=rings.map(r=>{
   assert.ok(r.length>=20,`${id}: missing full shaft ring`);
   const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
   for(const i of r)for(let k=0;k<4;k++){
    assert.equal(si.array[i*4+k],si.array[r[0]*4+k],`${id}: inconsistent bones around cuff`);
    assert.ok(Math.abs(sw.array[i*4+k]-sw.array[r[0]*4+k])<1e-6,`${id}: serrated cuff weights`);
   }
   for(const i of r){assert.ok(Math.abs(n.getY(i))<1e-5,`${id}: inconsistent shaft normals`);assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);}
   return [Math.min(...r.map(i=>p.getX(i))),Math.max(...r.map(i=>p.getX(i))),Math.min(...r.map(i=>p.getZ(i))),Math.max(...r.map(i=>p.getZ(i)))];
  });
  for(const b of bounds)for(let k=0;k<4;k++)assert.ok(Math.abs(b[k]-bounds[0][k])<1e-5,`${id}: invented calf bulge or ankle taper`);
 }
 const bones=mesh.skeleton.bones;
 for(let i=0;i<p.count;i++)if(p.getY(i)>.5){
  const opposite=p.getX(i)>0?'R_':'L_';
  for(let k=0;k<4;k++){const j=mesh.geometry.attributes.skinIndex.array[i*4+k],w=mesh.geometry.attributes.skinWeight.array[i*4+k];if(w>1e-6)assert.ok(!bones[j].name.startsWith(opposite),`${id}: opposite leg influences shaft`);}
 }
 console.log(id,'constant straight shaft, smooth normals, correct leg ownership');
}
