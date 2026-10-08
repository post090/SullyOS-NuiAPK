import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {MIRROR_GROOM_SECONDS} from '../apps/room3d/chibi/mirrorGrooming';
it('grooms with fixed feet and bone lengths at three heights, and restores idle on interruption',()=>{
 for(const bodyHeight of [.8,1,1.25]){
  const body=new T.Group(),hair=new T.Group(),geometry=createBlankBody('skin',{bodyHeight}),material=new T.MeshBasicMaterial();
  const mesh=new T.Mesh(geometry,material);body.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body);
  animate(0,'idle','standing');const lengths=rig.skeleton.bones.map(b=>b.position.length()),idle=rig.skeleton.bones.map(b=>b.quaternion.clone()),feet=['L_foot','R_foot'].map(n=>rig.bones[n].getWorldPosition(new T.Vector3()));
  const hands:T.Vector3[]=[];
  for(let t=0;t<=MIRROR_GROOM_SECONDS;t+=.05){
   animate(t,'mirror-admire','standing');expect(rig.skeleton.bones).toHaveLength(48);expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
   expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
   ['L_foot','R_foot'].forEach((n,i)=>expect(rig.bones[n].getWorldPosition(new T.Vector3()).distanceTo(feet[i])).toBeLessThan(1e-6));
   if(Math.abs(t-2)<.01||Math.abs(t-4.5)<.01)hands.push(rig.bones.R_hand.getWorldPosition(new T.Vector3()));
  }
  expect(hands[0].distanceTo(hands[1])).toBeGreaterThan(.2);
  animate(4.5,'mirror-admire','standing');animate(0,'idle','standing');
  rig.skeleton.bones.forEach((b,i)=>expect(b.quaternion.angleTo(idle[i])).toBeLessThan(1e-6));
  geometry.dispose();material.dispose();rig.skeleton.dispose();
 }
});
