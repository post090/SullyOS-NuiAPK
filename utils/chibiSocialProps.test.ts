import {it,expect,vi} from 'vitest';
import * as T from 'three';
import type {ChibiVisitor} from '../apps/room3d/chibi/visitor';
import {createSocialProp} from '../apps/room3d/chibi/socialProps';
import {furniturePalm} from '../apps/room3d/chibi/furnitureMotion';

it.each([['vrma-54a37ca48a1d4ffb','L'],['vrma-cae36da2cc8b9845','R']] as const)('attaches %s to the supporting %s hand, independently of the other wrist, then disposes it',(id,side)=>{
 const scene=new T.Group(),root=new T.Group(),hand=new T.Bone(),other=new T.Bone();scene.add(root);root.add(hand,other);
 scene.position.set(2,1,-3);scene.rotation.y=.8;scene.scale.setScalar(.7);root.scale.setScalar(.53);hand.position.set(-.8,2,.3);
 const visitor={root,rig:{bones:{[side+'_hand']:hand,[(side==='L'?'R':'L')+'_hand']:other}}} as unknown as ChibiVisitor;
 const prop=createSocialProp(id,[visitor])!,phone=hand.getObjectByName('social-phone')!;
 expect(phone?.parent).toBe(hand);
 const expected=furniturePalm(side);expected.y-=.018;
 for(const angle of [0,.5,1.3,-1]){
  hand.rotation.set(angle,-angle*.7,.8);root.rotation.y=angle;scene.updateMatrixWorld(true);prop.update(3,10,1);
  expect(phone.position.distanceTo(expected)).toBeLessThan(1e-10);
  const palmOut=new T.Vector3(0,-1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
  const screenOut=new T.Vector3(0,0,1).applyQuaternion(phone.getWorldQuaternion(new T.Quaternion()));
  expect(palmOut.dot(screenOut)).toBeCloseTo(1,6);
  expect(phone.getWorldPosition(new T.Vector3()).distanceTo(hand.localToWorld(expected.clone()))).toBeLessThan(1e-8);
  const before=phone.matrixWorld.clone();other.position.set(angle,angle*2,-angle);other.rotation.set(angle,angle,angle);scene.updateMatrixWorld(true);prop.update(4,10,1);
  phone.updateWorldMatrix(true,false);expect(phone.matrixWorld.elements).toEqual(before.elements);
 }
 prop.update(0,10,0);expect(phone.visible).toBe(false);
 const meshes=phone.children as T.Mesh[],disposed=meshes.map(m=>vi.spyOn(m.geometry,'dispose'));
 prop.dispose();expect(hand.getObjectByName('social-phone')).toBeUndefined();disposed.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
});
