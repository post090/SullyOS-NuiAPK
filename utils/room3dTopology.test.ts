import {ROOM_HALF,ROOM_STEP} from '../apps/room3d/dimensions.js';
import {describe,it,expect} from 'vitest';
import data from '../public/room3d/catalog.json';
import {BUILDING_ASSETS} from '../apps/room3d/building.js';
import {createHome,addRoom,validateHome,placementError} from '../apps/room3d/model.js';
import {displayRooms,setBoundary,roomGroups,boundary,wallVisible,connectedRooms,validateBoundaries} from '../apps/room3d/topology.js';
import {layoutRoom,moveInHome,layoutError} from '../apps/room3d/layout.js';
import {walkingMap,findWalkPath,doorTarget} from '../apps/room3d/navigation.js';
const catalog=[...data,...BUILDING_ASSETS];
function house(){const h=createHome(catalog);h.rooms[0].items=[];return h;}
const furniture=(assetId='table')=>({id:'f',assetId,x:0,y:.15,z:0,rotation:0,color:null,stored:false});
describe('physical room boundaries and views',()=>{
 it('isolates the selected room without changing merged rooms or navigation',()=>{
  const h=house(),a=h.rooms[0],b=addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'open'},catalog);const before=JSON.stringify(h);
  expect(displayRooms(h,a).map(r=>r.id)).toEqual([a.id,b.id]);expect(displayRooms(h,b,'room')).toEqual([b]);
  expect(roomGroups(h,catalog)).toHaveLength(1);expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).not.toBeNull();expect(JSON.stringify(h)).toBe(before);
 });
 it('hides walls without changing collision or room count',()=>{
  const h=house(),a=h.rooms[0];addRoom(h,'right');
  for(const view of ['cutaway','dollhouse','hidden']){expect(wallVisible(view,'right')).toBe(view==='dollhouse');expect(roomGroups(h,catalog)).toHaveLength(2);expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).toBeNull();}
  expect(wallVisible('hidden','left',true)).toBe(false);expect(boundary(a,'front').kind).toBe('wall_high');
 });
 it('merges open sides and splits again with any complete wall type, including loose segments',()=>{
  const h=house(),a=h.rooms[0],b=addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'open'},catalog);
  expect(roomGroups(h,catalog)).toHaveLength(1);expect(boundary(b,'left').kind).toBe('open');expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).not.toBeNull();
  for(const kind of ['wall_high','wall_low','wall_fence']){setBoundary(h,a.id,'right',{kind},catalog);expect(roomGroups(h,catalog)).toHaveLength(2);}
  setBoundary(h,a.id,'right',{kind:'open'},catalog);
  a.items.push({...furniture('wall_low'),x:ROOM_HALF.x,length:ROOM_STEP.z,rotation:90});expect(roomGroups(h,catalog)).toHaveLength(2);
  a.items[0].length=ROOM_STEP.z-1.3;expect(roomGroups(h,catalog)).toHaveLength(1);expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).toBeNull();
 });
 it('allows furniture across a removed seam, migrates ownership, and rejects restoring through it',()=>{
  const h=house(),a=h.rooms[0],b=addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'open'},catalog);a.items.push(furniture());
  moveInHome(h,a,'f',{x:ROOM_HALF.x},catalog);expect(layoutError(h,catalog)).toBe('');
  const saved=validateHome(h,catalog);expect(saved.rooms).toEqual(h.rooms);
  setBoundary(h,a.id,'right',{kind:'wall_low'},catalog);expect(layoutError(h,catalog)).not.toBe('');
  setBoundary(h,a.id,'right',{kind:'open'},catalog);moveInHome(h,a,'f',{x:ROOM_STEP.x},catalog);expect(b.items[0].x).toBeCloseTo(0);expect(a.items).toHaveLength(0);
 });
 it('keeps supported objects with their table when crossing into the next tile',()=>{
  const h=house(),a=h.rooms[0],b=addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'open'},catalog);a.items.push(furniture());
  const table=catalog.find(a=>a.id==='table')!;a.items.push({...furniture('tea_mug'),id:'mug',supportId:'f',y:.15+table.support!.height});
  moveInHome(h,a,'f',{x:ROOM_STEP.x},catalog);expect(b.items).toHaveLength(2);expect(validateHome(h,catalog).rooms).toEqual(h.rooms);
 });
 it('inherits an existing exterior opening when extending and validates both sides',()=>{
  const h=house(),a=h.rooms[0];setBoundary(h,a.id,'right',{kind:'wall_high',door:{kind:'arch',at:0,width:2}},catalog);const b=addRoom(h,'right');expect(boundary(b,'left')).toEqual(boundary(a,'right'));expect(()=>validateHome(h,catalog)).not.toThrow();
  b.boundaries!.left={kind:'open'};expect(()=>validateBoundaries(h)).toThrow('不一致');
 });
});
describe('chibi passage through doors',()=>{
 it.each(['door','arch','sliding'])('uses a real head-width passage for %s while retaining two rooms',kind=>{
  const h=house(),a=h.rooms[0];addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'wall_high',door:{kind,at:0,width:2}},catalog);
  expect(roomGroups(h,catalog)).toHaveLength(2);expect(connectedRooms(h,a.id,catalog,true)).toHaveLength(2);
  const map=walkingMap(h,0,catalog),path=findWalkPath(map,[0,0],[ROOM_STEP.x,0]);expect(path).not.toBeNull();for(const p of path!)expect(map.free(...p)).toBe(true);
  expect(findWalkPath(walkingMap(h,0,catalog,{headWidth:2.2}),[0,0],[ROOM_STEP.x,0])).toBeNull();
 });
 it.each(['front','back','left','right'])('can leave and reenter through the %s exterior door',edge=>{
  const h=house(),a=h.rooms[0];setBoundary(h,a.id,edge,{kind:'wall_high',door:{kind:'door',at:0,width:2}},catalog);
  const map=walkingMap(h,0,catalog),out=doorTarget(h,a,edge),inside=doorTarget(h,a,edge,true);expect(findWalkPath(map,[0,0],out)).not.toBeNull();expect(findWalkPath(map,out,inside)).not.toBeNull();
 });
 it('rejects a blocked doorway and undersized doors',()=>{
  const h=house(),a=h.rooms[0];addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'wall_high',door:{kind:'door',at:0,width:2}},catalog);
  a.items.push({...furniture('bookcase'),x:ROOM_HALF.x-.55});expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).toBeNull();
  expect(()=>setBoundary(h,a.id,'right',{kind:'wall_high',door:{kind:'door',at:0,width:1}},catalog)).toThrow();
 });
});
