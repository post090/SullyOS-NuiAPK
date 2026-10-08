import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {BLANK_FINGERS} from '../apps/room3d/chibi/blankFingers';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import source from '../apps/room3d/chibi/blankBody.json';

function setup(){
 const root=new T.Group(),g=createBlankBody('skin'),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(g,material),hair=new T.Group();root.add(mesh,hair);
 const rig=bindBlankBody(mesh,hair);
 const update=()=>{root.updateMatrixWorld(true);rig.skeleton.update();};
 const point=(i:number)=>rig.mesh.getVertexPosition(i,new T.Vector3());
 const tips=([-1,1] as const).flatMap(sign=>BLANK_FINGERS.map(f=>{
  let id=0,distance=Infinity;for(let i=0;i<source.positions.length/3;i++){
   const [x,y,z]=source.positions.slice(i*3,i*3+3),d=(x-sign*f.tip[0])**2+(y-f.tip[1])**2+(z-f.tip[2])**2;
   if(d<distance){id=i;distance=d;}
  }return {id,name:`${sign===1?'L':'R'}_${f.name}`};
 }));
 return {rig,update,point,tips,dispose(){g.dispose();material.dispose();rig.skeleton.dispose();}};
}
describe('independent chibi fingers',()=>{
 it('binds all ten digits to their own two joints without moving neighboring fingertips',()=>{
  const s=setup();try{
   for(const tip of s.tips){
    s.rig.setPose('bind');const before=s.tips.map(t=>s.point(t.id));
    expect(s.rig.bones[`${tip.name}_tip`].parent).toBe(s.rig.bones[tip.name]);
    s.rig.bones[tip.name].rotation.z=.65;s.update();
    s.tips.forEach((t,i)=>{const distance=s.point(t.id).distanceTo(before[i]);if(t===tip)expect(distance).toBeGreaterThan(.035);else expect(distance).toBeLessThan(.00001);});
   }
  }finally{s.dispose();}
 });
 it('curls both hands symmetrically, leaves the wrist fixed, and resets without changing geometry',()=>{
  const s=setup();try{
   const original=Array.from(s.rig.mesh.geometry.attributes.position.array),rest=s.tips.map(t=>s.point(t.id));
   s.rig.setHandCurl('L',1);s.rig.setHandCurl('R',1);s.update();
   for(let i=0;i<s.tips.length;i++)expect(s.point(s.tips[i].id).distanceTo(rest[i])).toBeGreaterThan(.03);
   for(let i=0;i<5;i++){const a=s.point(s.tips[i].id),b=s.point(s.tips[i+5].id);expect(a.x).toBeCloseTo(-b.x,5);expect(a.y).toBeCloseTo(b.y,5);expect(a.z).toBeCloseTo(b.z,5);}
   for(let i=0;i<source.positions.length/3;i++){
    const x=Math.abs(source.positions[i*3]);if(x>.27&&x<.30)expect(s.point(i).distanceTo(new T.Vector3().fromBufferAttribute(s.rig.mesh.geometry.attributes.position,i))).toBeLessThan(.00001);
   }
   s.rig.setPose('bind');s.tips.forEach((t,i)=>expect(s.point(t.id).distanceTo(rest[i])).toBeLessThan(.00001));
   expect(Array.from(s.rig.mesh.geometry.attributes.position.array)).toEqual(original);
  }finally{s.dispose();}
 });
});
