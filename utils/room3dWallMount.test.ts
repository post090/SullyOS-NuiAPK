import {ROOM_HALF} from '../apps/room3d/dimensions.js';
import {describe,it,expect} from 'vitest';
import catalogData from '../public/room3d/catalog.json';
import {BUILDING_ASSETS} from '../apps/room3d/building.js';
import {snapToWall,wallPlacementError} from '../apps/room3d/wallMount.js';
import {createHome,validateHome,findPlace,moveFurniture,placementError,furnitureType,isWaterablePlant} from '../apps/room3d/model.js';
import {roomPlants} from '../apps/room3d/watering.js';
const catalog=[...catalogData,...BUILDING_ASSETS],windowAsset=catalog.find(a=>a.id==='wooden_window')!;
const windowItem={id:'win',assetId:'wooden_window',x:0,y:2,z:0,rotation:0,color:'#91C9F4',stored:false};
const room=(items:any[]=[])=>({id:'room',items});
describe('plant category and shared watering contract',()=>{
 it('requires both floor placement and watering capability',()=>{
  expect(furnitureType(catalog.find(a=>a.id==='monstera')!)).toBe('plants');
  for(const surface of ['tabletop','back','left','wall','ceiling']){const a={...windowAsset,id:'fake',surface,waterable:true};expect(isWaterablePlant(a)).toBe(false);expect(furnitureType(a)).not.toBe('plants');expect(roomPlants(room([{...windowItem,assetId:'fake'}]),[a])).toEqual([]);}
  expect(furnitureType({...windowAsset,surface:'floor',waterable:false})).toBe('floor');
 });
});
describe('one window, nearest existing wall',()=>{
 it('snaps to back and left, changes facing, and keeps height',()=>{
  const back=snapToWall({...windowItem,z:-ROOM_HALF.z+.25},windowAsset,room(),catalog);expect(back.rotation).toBe(0);expect(back.z).toBeCloseTo(-ROOM_HALF.z+.12+windowAsset.size[2]/2+.012);
  const left=snapToWall({...back,x:-ROOM_HALF.x+.2,z:.2},windowAsset,room(),catalog);expect(left.rotation).toBe(90);expect(left.y).toBe(2);expect(left.assetId).toBe('wooden_window');expect(wallPlacementError(left,windowAsset,room(),catalog)).toBe('');
 });
 it('does not attach to open boundaries, low walls or fences',()=>{
  for(const assetId of ['wall_low','wall_fence']){const r=room([{id:'wall',assetId,x:0,y:.15,z:ROOM_HALF.z,length:3,rotation:0,stored:false,color:null}]);const snapped=snapToWall({...windowItem,z:ROOM_HALF.z-.35},windowAsset,r,catalog);if(snapped.rotation===180)expect(Math.abs(snapped.x)-windowAsset.size[0]/2).toBeGreaterThan(1.5);}
  expect(snapToWall({...windowItem,x:ROOM_HALF.x-.3,z:0},windowAsset,{...room(),boundaries:{right:{kind:'open'}}},catalog).rotation).not.toBe(270);
 });
 it('uses added high walls on front / right and rejects collisions',()=>{
  const wall={id:'wall',assetId:'wall_high',x:0,y:.15,z:ROOM_HALF.z,length:3,rotation:0,stored:false,color:null},r=room([wall]);
  const front=snapToWall({...windowItem,z:ROOM_HALF.z-.35},windowAsset,r,catalog);expect(front.rotation).toBe(180);expect(placementError(front,r,catalog)).toBe('');
  const rightRoom=room([{...wall,x:ROOM_HALF.x,z:0,rotation:90}]),right=snapToWall({...windowItem,x:ROOM_HALF.x-.3},windowAsset,rightRoom,catalog);expect(right.rotation).toBe(270);expect(placementError(right,rightRoom,catalog)).toBe('');
  r.items.push(front);expect(placementError({...front,id:'other'},r,catalog)).toContain('碰到');
 });
 it('clamps at corners and top/bottom, never overhangs',()=>{
  const next=snapToWall({...windowItem,x:-3,z:-2.5,y:10},windowAsset,room(),catalog);expect(next.y+windowAsset.size[1]).toBeLessThan(4.8);expect(wallPlacementError(next,windowAsset,room(),catalog)).toBe('');
  const low=snapToWall({...windowItem,y:-5,z:-2.5},windowAsset,room(),catalog);expect(low.y).toBeGreaterThanOrEqual(.15);
 });
 it('joins adjacent high-wall faces without bridging a gap',()=>{
  const wall={id:'a',assetId:'wall_high',x:-.6,y:.15,z:ROOM_HALF.z,length:1.2,rotation:0,stored:false,color:null},r={...room([wall,{...wall,id:'b',x:.6}]),boundaries:{front:{kind:'open'}}};
  expect(snapToWall({...windowItem,z:ROOM_HALF.z-.35},windowAsset,r,catalog).rotation).toBe(180);r.items[1].x=1;const snapped=snapToWall({...windowItem,z:ROOM_HALF.z-.35},windowAsset,r,catalog);if(snapped.rotation===180)expect(Math.abs(snapped.x)-windowAsset.size[0]/2).toBeGreaterThan(1.5);
 });
 it('migrates old left windows without changing IDs/color or input objects',()=>{
  const home=createHome(catalog);home.rooms[0].items=[{...windowItem,assetId:'wooden_window_left',x:-2.84,z:0}];const migrated=validateHome(home,catalog),i=migrated.rooms[0].items[0];expect(home.rooms[0].items[0].assetId).toBe('wooden_window_left');expect(i.assetId).toBe('wooden_window');expect(i.rotation).toBe(90);expect(i.color).toBe(windowItem.color);expect(i.id).toBe('win');expect(wallPlacementError(i,windowAsset,migrated.rooms[0],catalog)).toBe('');
 });
 it('preserves wall poses through move, copy placement and save validation',()=>{
  const home=createHome(catalog),r=home.rooms[0];r.items=[findPlace(windowAsset,r,catalog,'win')];moveFurniture(r,'win',{x:-ROOM_HALF.x+.2,z:.1,y:2.2},catalog);expect(r.items[0].rotation).toBe(90);expect(r.items[0].y).toBe(2.2);
  const copy=findPlace(windowAsset,r,catalog,'copy');r.items.push(copy);expect(placementError(copy,r,catalog)).toBe('');expect(validateHome(home,catalog).rooms).toEqual(home.rooms);
 });
});
