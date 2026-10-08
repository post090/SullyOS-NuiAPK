import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {dressBlankBody} from '../apps/room3d/chibi/blankClothes';
import {dressHoodie} from '../apps/room3d/chibi/hoodieClothes';
import {BLANK_SCALE} from '../apps/room3d/chibi/blankBody';
import sourceBody from '../apps/room3d/chibi/blankBody.json';

function setup(){
 const group=new T.Group(),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(createBlankBody('skin'),material),hair=new T.Group();
 hair.position.set(.2,3,.1);group.add(mesh,hair);const rig=bindBlankBody(mesh,hair);
 return {rig,hair,dispose(){mesh.geometry.dispose();material.dispose();rig.skeleton.dispose();}};
}
describe('Blank Buddy skinning',()=>{
 it('matches the hoodie reference head ratio without resizing the torso or feet',()=>{
  const g=createBlankBody('skin',{headSize:1}),p=g.attributes.position,head=new T.Box3(),v=new T.Vector3();
  try{
   for(let i=0;i<p.count;i++){
    const [x,y,z]=sourceBody.positions.slice(i*3,i*3+3);v.fromBufferAttribute(p,i);
    if(y<=.125)expect(v.distanceTo(new T.Vector3(x,y+.5,z).multiplyScalar(BLANK_SCALE))).toBeLessThan(.000001);
    if(y>=.16)head.expandByPoint(v);
   }
   const torso=.65*BLANK_SCALE,size=head.getSize(new T.Vector3());
   expect(size.x/torso).toBeCloseTo(.3327/.72,2);
   expect((head.max.y-torso)/torso).toBeCloseTo(.28/.72,2);
   expect(size.z/torso).toBeCloseTo(.2836/.72,2);
  }finally{g.dispose()}
 });
 it('keeps the extracted hoodie below 4000 triangles with valid skinning and reversible masking',()=>{
  const {rig,dispose}=setup(),original=Array.from(rig.mesh.geometry.index!.array),outfit=dressHoodie(rig);
  try{
   expect(outfit.triangles).toBeLessThanOrEqual(4000);
   const kept=rig.mesh.geometry.index!,positions=rig.mesh.geometry.attributes.position,triangles=new Set<string>();
   for(let i=0;i<kept.count;i+=3)triangles.add([kept.getX(i),kept.getX(i+1),kept.getX(i+2)].join(','));
   for(let i=0;i<original.length;i+=3){const ids=original.slice(i,i+3),ys=ids.map(id=>positions.getY(id)/BLANK_SCALE-.5);
    if(Math.min(...ys)<-.126&&Math.max(...ys)>-.244&&Math.max(...ys)<0)expect(triangles.has(ids.join(','))).toBe(true);
   }
   for(const pose of ['bind','relaxed','arm','knee','head'] as const){rig.setPose(pose);
    for(const mesh of outfit.meshes){mesh.updateWorldMatrix(true,false);const w=mesh.geometry.attributes.skinWeight,v=new T.Vector3();
     for(let i=0;i<w.count;i++){expect(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)).toBeCloseTo(1,5);mesh.getVertexPosition(i,v);expect(Number.isFinite(v.lengthSq())).toBe(true);}
    }
   }
   outfit.setVisible(false);expect(Array.from(rig.mesh.geometry.index!.array)).toEqual(original);
  }finally{outfit.resources.forEach(r=>r.dispose());dispose();}
 });
 it('skins the garment on the same skeleton and restores covered body faces when removed',()=>{
  const {rig,dispose}=setup(),index=Array.from(rig.mesh.geometry.index!.array),groups=rig.mesh.geometry.groups.map(g=>({...g}));
  const outfit=dressBlankBody(rig);
  try{
   expect(outfit.mesh.skeleton).toBe(rig.skeleton);
   expect(rig.mesh.geometry.index!.count).toBeLessThan(index.length);
   const g=outfit.mesh.geometry,w=g.attributes.skinWeight,v=new T.Vector3();
   for(const pose of ['relaxed','arm','knee'] as const){rig.setPose(pose);outfit.mesh.updateWorldMatrix(true,false);
    for(let i=0;i<g.attributes.position.count;i++){outfit.mesh.getVertexPosition(i,v);expect(Number.isFinite(v.lengthSq())).toBe(true);expect(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)).toBeCloseTo(1,5);}
   }
   outfit.setVisible(false);expect(Array.from(rig.mesh.geometry.index!.array)).toEqual(index);expect(rig.mesh.geometry.groups).toEqual(groups);
  }finally{outfit.resources.forEach(r=>r.dispose());dispose();}
 });
 it('binds all vertices with normalized valid influences without changing the approved rest shape',()=>{
  const {rig,dispose}=setup();try{
   expect(rig.skeleton.bones.length).toBe(42);const g=rig.mesh.geometry,p=g.attributes.position,weights=g.attributes.skinWeight,indices=g.attributes.skinIndex;
   const approved=createBlankBody('skin');expect(g.index!.count).toBe(approved.index!.count);approved.dispose();
   rig.setPose('bind');const v=new T.Vector3(),rest=new T.Vector3();
   for(let i=0;i<p.count;i++){
    let sum=0;for(let j=0;j<4;j++){const w=weights.array[i*4+j],id=indices.array[i*4+j];expect(w).toBeGreaterThanOrEqual(0);expect(id).toBeLessThan(42);sum+=w;}
    expect(sum).toBeCloseTo(1,5);rig.mesh.getVertexPosition(i,v);rest.fromBufferAttribute(p,i);expect(v.distanceTo(rest)).toBeLessThan(.00001);
   }
  }finally{dispose();}
 });
 it('moves the head and attached hair together, while relaxed arms leave feet planted',()=>{
  const {rig,hair,dispose}=setup();try{
   const before=hair.getWorldPosition(new T.Vector3());rig.setPose('head');expect(hair.getWorldPosition(new T.Vector3()).distanceTo(before)).toBeGreaterThan(.01);
   expect(hair.parent).toBe(rig.bones.head);rig.setPose('relaxed');const p=rig.mesh.geometry.attributes.position,v=new T.Vector3(),rest=new T.Vector3();
   for(let i=0;i<p.count;i++)if(p.getY(i)<.25){rig.mesh.getVertexPosition(i,v);rest.fromBufferAttribute(p,i);expect(v.distanceTo(rest)).toBeLessThan(.00001);}
  }finally{dispose();}
 });
 it('bends only the tested leg and resets cleanly without modifying mesh positions',()=>{
  const {rig,dispose}=setup();try{
   const p=rig.mesh.geometry.attributes.position,original=Array.from(p.array),v=new T.Vector3(),rest=new T.Vector3();let moved=0;
   rig.setPose('knee');for(let i=0;i<p.count;i++){rig.mesh.getVertexPosition(i,v);rest.fromBufferAttribute(p,i);expect(Number.isFinite(v.lengthSq())).toBe(true);if(p.getY(i)<.3){if(p.getX(i)>0)moved=Math.max(moved,v.distanceTo(rest));else expect(v.distanceTo(rest)).toBeLessThan(.00001);}}
   expect(moved).toBeGreaterThan(.1);rig.setPose('bind');expect(Array.from(p.array)).toEqual(original);
  }finally{dispose();}
 });
});
