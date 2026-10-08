import {it,expect} from 'vitest';
import {Group,Quaternion,Vector3} from 'three';
import {setResidentHeading} from '../apps/room3d/residentFacing';
it('clears XYZ half-turn remnants when a reparented user walks, sits or lies down',()=>{
 for(const before of [Math.PI,Math.PI*.75,-Math.PI*.75])for(const target of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const root=new Group();root.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),before));
  setResidentHeading(root,target);
  const forward=new Vector3(0,0,1).applyQuaternion(root.quaternion),up=new Vector3(0,1,0).applyQuaternion(root.quaternion);
  expect(forward.x).toBeCloseTo(Math.sin(target));expect(forward.z).toBeCloseTo(Math.cos(target));expect(up.y).toBeCloseTo(1);
 }
});
