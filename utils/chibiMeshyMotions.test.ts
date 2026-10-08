import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {createMeshySampler,meshyMotions,meshySelections} from '../apps/room3d/chibi/meshyMotions';

it('keeps the eight approved source identities and holds one-shot endpoints',()=>{
 expect(meshySelections.map(s=>s[0])).toEqual(['01','04','06','07','08','09','10','13']);
 for(const [,id]of meshySelections){
  const clip=meshyMotions[id],pose=Object.fromEntries(Object.keys(clip.tracks).map(n=>[n,new T.Quaternion()])),root=new T.Vector3(),sample=createMeshySampler(id);
  expect(clip.sourceSha256).toMatch(/^[a-f0-9]{64}$/);sample(clip.duration,pose,root);const end=pose.hips.clone(),position=root.clone();
  sample(clip.duration+5,pose,root);expect(pose.hips.angleTo(end)).toBeLessThan(1e-6);expect(root.distanceTo(position)).toBeLessThan(1e-6);
  sample(.25,pose,root,true);const loop=pose.hips.clone();sample(.25+clip.duration,pose,root,true);expect(loop.angleTo(pose.hips)).toBeLessThan(1e-6);
 }
});
it('grounds yoga on the actual posed skin at different heights without changing the 48 bones',()=>{
 for(const bodyHeight of [.8,1,1.25]){
  const parent=new T.Group(),body=new T.Group(),hair=new T.Group(),mesh=new T.Mesh(createBlankBody('skin',{bodyHeight}),new T.MeshBasicMaterial());parent.add(body);body.add(mesh,hair);
  parent.position.set(2,.18,-3);parent.scale.setScalar(.53);parent.rotation.y=.6;
  const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body),lengths=rig.skeleton.bones.map(b=>b.position.length());
  for(let t=0;t<meshyMotions.yoga.duration*2;t+=.17){
   animate(t,'yoga','standing');parent.updateMatrixWorld(true);rig.skeleton.update();rig.mesh.computeBoundingBox();
   expect(rig.mesh.boundingBox!.min.y+body.position.y).toBeCloseTo(.035,4);
   expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
   expect(rig.skeleton.bones.length).toBe(48);expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
  }
  animate(0,'idle','standing');expect(body.position.length()).toBe(0);expect(body.quaternion.angleTo(new T.Quaternion())).toBeLessThan(1e-6);
  mesh.geometry.dispose();mesh.material.dispose();rig.skeleton.dispose();
 }
});
