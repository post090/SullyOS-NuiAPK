import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {seatChangeFrame,seatChangeDuration,wateringFrame} from '../apps/room3d/chibi/roomMotionFrame';
import {BLANK_SCALE} from '../apps/room3d/chibi/blankBody';
import {seatEntry,seatChangePose} from '../apps/room3d/seatChange.js';
import {createWateringEffect} from '../apps/room3d/wateringEffect.js';
import {walkingMap} from '../apps/room3d/navigation.js';
import {createHome} from '../apps/room3d/model.js';
import catalog from '../public/room3d/catalog.json';

describe('Body 2 living-room motion',()=>{
 it('keeps the cushion contact and narrow knees through sit, wave, stand and interruption at three heights',()=>{
  for(const bodyHeight of [.8,1,1.25]){
   const body=new T.Group(),hair=new T.Group(),material=new T.MeshBasicMaterial(),geometry=createBlankBody('skin',{bodyHeight}),mesh=new T.Mesh(geometry,material);
   body.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body);
   const lengths=rig.skeleton.bones.map(b=>b.position.length()),height=.42/(2.8/BLANK_SCALE);
   const seat={kind:'seat-rest',hands:[],seatPose:'floor' as const,seatHeight:height};
   for(const rising of [false,true])for(let t=0;t<=2.2;t+=.1){
    const f=seatChangeFrame(t,rising,'floor');animate(t,'idle','seated',{...seat,kind:'seat-change',seatWeight:f.weight,seatFold:f.fold,seatSupport:f.support,seatLean:f.lean});
    expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
    expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
   }
   animate(3,'idle','seated',seat);
   const left=rig.bones.L_foot.getWorldPosition(new T.Vector3()),right=rig.bones.R_foot.getWorldPosition(new T.Vector3());
   expect(left.y).toBeCloseTo(-height+.049*BLANK_SCALE,2);expect(right.y).toBeCloseTo(left.y,2);
   const knees=rig.bones.L_shin.getWorldPosition(new T.Vector3()).distanceTo(rig.bones.R_shin.getWorldPosition(new T.Vector3()));
   expect(knees*2.8/BLANK_SCALE).toBeLessThan(.30);
   animate(3,'wave-cute','seated',seat);expect(rig.bones.L_foot.getWorldPosition(new T.Vector3()).distanceTo(left)).toBeLessThan(.015);
   animate(0,'idle','standing');expect(body.position.length()).toBe(0);expect(rig.bones.L_thigh.quaternion.angleTo(new T.Quaternion())).toBeLessThan(1e-6);
   expect(rig.skeleton.bones).toHaveLength(48);rig.skeleton.dispose();geometry.dispose();material.dispose();
  }
 });
 it('gives floor sitting a support phase and a slower reversible settle without changing chair timing',()=>{
  expect(seatChangeDuration('floor')).toBeGreaterThan(seatChangeDuration('chair'));
  expect(seatChangeDuration('chair')).toBe(1.05);
  const start=seatChangeFrame(0,false,'floor'),end=seatChangeFrame(2.2,false,'floor');
  expect(start.weight).toBe(0);expect(start.fold).toBe(0);expect(end.weight).toBe(1);expect(end.fold).toBe(1);expect(end.support).toBe(0);
  expect(seatChangeFrame(.7,false,'floor').support).toBe(1);
  for(const t of [.1,.6,1.1,1.8])expect(seatChangeFrame(t,false,'floor').weight).toBeCloseTo(seatChangeFrame(2.2-t,true,'floor').weight);
 });
 it('keeps bone lengths and finite transforms at all heights and returns to standing after interruption',()=>{
  for(const bodyHeight of [.8,1,1.25]){
   const body=new T.Group(),hair=new T.Group(),material=new T.MeshBasicMaterial(),geometry=createBlankBody('skin',{bodyHeight}),mesh=new T.Mesh(geometry,material);
   body.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body);
   const lengths=rig.skeleton.bones.map(b=>b.position.length());
   animate(0,'idle','standing');const idle=rig.skeleton.bones.map(b=>b.quaternion.clone());
   for(const motion of ['walk','water'] as const)for(let t=0;t<4.5;t+=.125){
    animate(t,motion,'standing');expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
    expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
   }
   animate(2,'water','standing');
   const left=rig.bones.L_hand.getWorldPosition(new T.Vector3()),right=rig.bones.R_hand.getWorldPosition(new T.Vector3());
   // Preserve the approved wrist spacing relative to body size; the can follows the right wrist.
   expect(left.distanceTo(right)/BLANK_SCALE).toBeLessThan(.32/2.408);
   for(const rising of [false,true])for(let t=0;t<1.1;t+=.1){const f=seatChangeFrame(t,rising);animate(t,'idle','seated',{kind:'seat-change',hands:[],seatWeight:f.weight,seatLean:f.lean});}
   animate(0,'idle','standing');expect(body.position.length()).toBe(0);
   rig.skeleton.bones.forEach((b,i)=>expect(b.quaternion.angleTo(idle[i])).toBeLessThan(1e-6));
   rig.skeleton.dispose();geometry.dispose();material.dispose();
  }
 });
 it('uses free floor in front of rotated seats and ends exactly at each contact plane',()=>{
  const seat={position:[2,.7,3],rotation:Math.PI/2},front=seatEntry(seat,{free:(x:number,z:number)=>x>12.6&&z===23},[10,20]);
  expect(front).not.toBeNull();expect(front![1]).toBe(.18);
  const change={front:front!,seat:seat.position,rising:false};
  expect(seatChangePose(change,0).position).toEqual(front);expect(seatChangePose(change,2).position).toEqual(seat.position);
  expect(seatChangePose({...change,rising:true},2).position).toEqual(front);
  expect(seatEntry(seat,{free:()=>false})).toBeNull();
 });
 it('does not emit water before lifting or after lowering, and moves the can with the hand',()=>{
  const effect=createWateringEffect(),spot={position:[0,.18,0],target:[0,.5,1]},hands=[[-.15,1,.3],[.15,1,.3]];
  effect.update(0,spot,hands);expect(effect.root.children.every(o=>!o.visible)).toBe(true);
  effect.update(2,spot,hands);const can=effect.root.getObjectByName('watering-can')!,before=can.position.clone();
  expect(effect.root.children.every(o=>o.visible)).toBe(true);
  effect.update(2,spot,hands.map(p=>[p[0]+.2,p[1],p[2]]));expect(can.position.x-before.x).toBeCloseTo(.2);
  effect.update(4.4,spot,hands);expect(effect.root.children.every(o=>!o.visible)).toBe(true);
  effect.update(2,spot);expect(can.scale.x).toBe(1);expect(can.position.toArray()).toEqual([.08,.36,.36]);
  effect.update(0,null);expect(effect.root.visible).toBe(false);effect.dispose();
  expect(wateringFrame(2).pour).toBe(1);
 });
 it('clears low furniture beside the taller head but still blocks the torso and overhead objects',()=>{
  const home=createHome(catalog),room=home.rooms[0];room.items=[];
  const options={headWidth:1.5,headBottom:1.5,headTop:2.7};
  const map=walkingMap(home,0,catalog,options);
  map.obstacles.push([.4,.18,-.1,.6,1,.1]);expect(map.free(0,0)).toBe(true);
  map.obstacles.push([-.1,.8,-.1,.1,1,.1]);expect(map.free(0,0)).toBe(false);
  map.obstacles.splice(-1);map.obstacles.push([.4,2,-.1,.6,2.3,.1]);expect(map.free(0,0)).toBe(false);
 });
});

it('turns toward the seat before lowering and uses the shortest yaw arc',()=>{
 const change={front:[0,.18,1],seat:[0,.7,0],pose:'chair',rising:false,startRotation:170*Math.PI/180,rotation:-170*Math.PI/180};
 expect(seatChangePose(change,0).rotation).toBeCloseTo(change.startRotation);
 const turning=seatChangePose(change,.15);expect(turning.position).toEqual(change.front);expect(turning.rotation).toBeCloseTo(Math.PI);
 const end=seatChangePose(change,2);expect(Math.cos(end.rotation)).toBeCloseTo(Math.cos(change.rotation));expect(end.position).toEqual(change.seat);expect(end.done).toBe(true);
 expect(seatChangePose({...change,rising:true},.15).rotation).toBe(change.rotation);
});
