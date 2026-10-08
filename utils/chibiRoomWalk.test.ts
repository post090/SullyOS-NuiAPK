import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody,BLANK_SCALE} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {bodyHeightY} from '../apps/room3d/chibi/bodyHeight';
import {createRoomWalkSampler,roomWalkSpeed} from '../apps/room3d/chibi/roomWalk';
import {approvedRoomWalk} from '../apps/room3d/chibi/approvedRoomWalk';

it('plays the selected Meshy walk on the real rig with fixed bone lengths and grounded lower ankle, then restores idle',()=>{
 for(const bodyHeight of [.8,1,1.25]){
  const body=new T.Group(),hair=new T.Group(),geometry=createBlankBody('skin',{bodyHeight}),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material);body.add(mesh,hair);
  const rig=bindBlankBody(mesh,hair,true),options={walk:approvedRoomWalk},animate=createBlankMotion(rig,body,options),lengths=rig.skeleton.bones.map(b=>b.position.length());
  for(const clip of [approvedRoomWalk]){
   options.walk=clip;const speed=roomWalkSpeed(clip,rig.bones);expect(speed).toBeGreaterThan(.2);expect(speed).toBeLessThan(8);
   for(let t=0;t<clip.duration*2;t+=.07){
    animate(t,'walk','standing');expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
    expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
    const lowest=Math.min(...['L_foot','R_foot'].map(n=>rig.bones[n].getWorldPosition(new T.Vector3()).y));
    expect(lowest).toBeCloseTo(bodyHeightY(.049*BLANK_SCALE,bodyHeight),5);
   }
   animate(0,'idle','standing');expect(body.position.length()).toBeLessThan(1e-6);
  }
  geometry.dispose();material.dispose();rig.skeleton.dispose();
 }
});
it('loops the daily walk with normalized rotations',()=>{

 for(const clip of [approvedRoomWalk]){
  const pose=Object.fromEntries(Object.keys(clip.tracks).map(n=>[n,new T.Quaternion()])),sample=createRoomWalkSampler(clip);
  sample(.25,pose);const before=pose.L_thigh.clone();sample(.25+clip.duration,pose);expect(before.angleTo(pose.L_thigh)).toBeLessThan(1e-6);
  expect(Object.values(pose).every(q=>Math.abs(q.length()-1)<1e-5)).toBe(true);
 }
});
