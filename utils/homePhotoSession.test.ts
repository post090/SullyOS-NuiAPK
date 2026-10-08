import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createPhotoSession} from '../apps/room3d/photoSession.js';
describe('temporary photo staging',()=>{
 it('restores both actors and camera without persisting staged transforms',()=>{
  const camera=new THREE.OrthographicCamera(-3,3,3,-3);camera.position.set(2,4,8);camera.zoom=1.4;
  const controls={target:new THREE.Vector3(1,2,3)};
  const a=new THREE.Group(),b=new THREE.Group(),bone=new THREE.Object3D();a.add(bone);a.position.set(-1,.18,2);b.position.set(2,.18,4);bone.rotation.x=.3;
  const person={animate:vi.fn(()=>{bone.rotation.x=2;}),finishPose:vi.fn()};
  const session=createPhotoSession({actors:[{id:'a',label:'A',root:a,person},{id:'b',label:'B',root:b,person}],camera,controls,invalidate:vi.fn()});
  session.together(.9);expect(a.position.distanceTo(b.position)).toBeCloseTo(.9);session.pose('a','wave',2);session.turn('a',90);session.camera({yaw:50,zoom:2});
  session.restore();expect(a.position.toArray()).toEqual([-1,.18,2]);expect(b.position.toArray()).toEqual([2,.18,4]);expect(bone.rotation.x).toBeCloseTo(.3);expect(camera.position.toArray()).toEqual([2,4,8]);expect(camera.zoom).toBe(1.4);expect(controls.target.toArray()).toEqual([1,2,3]);
 });
 it('applies per-person faces and restores camera gaze without accumulating rotation',()=>{
  const root=new THREE.Group(),head=new THREE.Object3D();root.add(head);head.rotation.z=.2;
  const original=head.quaternion.clone(),setPhotoExpression=vi.fn();
  const person={rig:{bones:{head}},faceState:{eyes:'closed',mouth:'base'},setPhotoExpression,finishPose:vi.fn()};
  const camera=new THREE.OrthographicCamera();camera.position.set(3,2,8);
  const session=createPhotoSession({actors:[{id:'a',root,person}],camera,controls:{target:new THREE.Vector3()},invalidate:vi.fn()});
  session.face('a',{expression:'happy',lookCamera:true});const reset=session.prepare();
  expect(setPhotoExpression).toHaveBeenLastCalledWith('happy','smile');expect(head.quaternion.equals(original)).toBe(false);
  reset();expect(head.quaternion.equals(original)).toBe(true);
  session.face('a',{lookCamera:false});session.prepare()();expect(head.quaternion.equals(original)).toBe(true);
  session.restore();expect(setPhotoExpression).toHaveBeenLastCalledWith('closed','base');
 });
 it('does not stage absent residents or execute arbitrary action names',()=>{
  const root=new THREE.Group();root.visible=false;const person={animate:vi.fn()};const s=createPhotoSession({actors:[{id:'away',root,person}],camera:new THREE.OrthographicCamera(),controls:{target:new THREE.Vector3()},invalidate:vi.fn()});
  expect(s.actors).toEqual([]);s.pose('away','anything',1);expect(person.animate).not.toHaveBeenCalled();s.restore();expect(root.visible).toBe(false);
 });
});
