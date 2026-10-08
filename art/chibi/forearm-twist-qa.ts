import * as T from 'three';
import assert from 'node:assert/strict';
import test from 'node:test';
import {extractTwist,constrainForearmTwist} from '../../experiments/chibi/forearmTwist';
import {createBlankBody} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';

test('twist extraction rejects wrist swing and keeps the axial component',()=>{
 const axis=new T.Vector3(1,0,.006/.095).normalize(),bendAxis=new T.Vector3(0,1,0);
 for(const degrees of [-170,-90,-30,0,30,90,170]){
  const twist=new T.Quaternion().setFromAxisAngle(axis,degrees*Math.PI/180);
  const bend=new T.Quaternion().setFromAxisAngle(bendAxis,.65);
  assert.ok(extractTwist(bend.clone().multiply(twist),axis).angleTo(twist)<1e-6);
 }
 assert.ok(extractTwist(new T.Quaternion().setFromAxisAngle(bendAxis,.65),axis).angleTo(new T.Quaternion())<1e-6);
});
test('independent helper constraints follow 25/50/75 percent without moving wrist',()=>{
 const scene=new T.Scene(),hair=new T.Group(),mesh=new T.Mesh(createBlankBody('skin'));
 scene.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true);
 const pose=Object.fromEntries(Object.keys(rig.bones).map(name=>[name,new T.Quaternion()]));
 for(const side of ['L','R'] as const){
  const axis=rig.bones[`${side}_hand`].position.clone().normalize();
  for(const degrees of [-170,-90,0,90,170]){
   for(const q of Object.values(pose))q.identity();
   const angle=degrees*Math.PI/180;pose[`${side}_hand`].setFromAxisAngle(axis,angle);
   constrainForearmTwist(rig,pose,side);
   for(const [i,fraction] of [[1,.25],[2,.5],[3,.75]]){
    assert.ok(pose[`${side}_twist${i}`].angleTo(new T.Quaternion().setFromAxisAngle(axis,angle*fraction))<1e-6);
    const offset=rig.bones[`${side}_twist${i}`].position;
    assert.ok(offset.clone().cross(axis).length()<1e-6,'Helper pivot lies on the elbow-wrist axis');
   }
   for(const [name,q] of Object.entries(pose))rig.bones[name].quaternion.copy(q);
   scene.updateMatrixWorld(true);rig.skeleton.update();
   for(let i=0;i<rig.mesh.geometry.attributes.position.count;i++)assert.ok(Number.isFinite(rig.mesh.getVertexPosition(i,new T.Vector3()).lengthSq()));
  }
 }
});
