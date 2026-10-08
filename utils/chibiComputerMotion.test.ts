import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
it('computer contact keeps the seat, feet and bone lengths stable while moving to the mouse and releasing on idle',()=>{
 for(const kind of ['computer','stream'] as const)for(const bodyHeight of [.8,1,1.25]){
  const parent=new T.Group(),body=new T.Group(),hair=new T.Group(),geometry=createBlankBody('skin',{bodyHeight}),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material);parent.add(body);body.add(mesh,hair);
  const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body),lengths=rig.skeleton.bones.map(b=>b.position.length());
  const activity={kind,hands:[[-.26,.25,.65],[.26,.25,.65]],mouseHand:[-.7,.28,.66],handScale:.7/.529};
  animate(0,'idle','seated');const feet=['L_foot','R_foot'].map(n=>rig.bones[n].getWorldPosition(new T.Vector3())),seat=rig.bones.hips.getWorldPosition(new T.Vector3());
  let typing=new T.Vector3(),mouse=new T.Vector3();
  for(let t=0;t<=11;t+=.05){animate(t,kind,'seated',activity);expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
   ['L_foot','R_foot'].forEach((n,i)=>expect(rig.bones[n].getWorldPosition(new T.Vector3()).distanceTo(feet[i])).toBeLessThan(.025));expect(rig.bones.hips.getWorldPosition(new T.Vector3()).distanceTo(seat)).toBeLessThan(1e-6);
   if(Math.abs(t-2)<.01)typing=rig.bones.R_hand.getWorldPosition(new T.Vector3());if(Math.abs(t-7)<.01)mouse=rig.bones.R_hand.getWorldPosition(new T.Vector3());
  }
  expect(mouse.x).toBeLessThan(typing.x-.2);animate(0,'idle','standing');expect(body.position.length()).toBe(0);expect(rig.skeleton.bones).toHaveLength(48);
  rig.skeleton.dispose();geometry.dispose();material.dispose();
 }
});
