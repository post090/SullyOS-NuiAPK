import {describe,it,expect} from 'vitest';
import data from '../public/room3d/catalog.json';
import {BUILDING_ASSETS,ROOM_EDGES,buildingEdge} from '../apps/room3d/building.js';
import {ROOM_HALF,ROOM_STEP} from '../apps/room3d/dimensions.js';
import {createHome,validateHome,addRoom,placementError} from '../apps/room3d/model.js';
import {displayRooms,roomGroups,setBoundary} from '../apps/room3d/topology.js';
import {gamingPreset,gamingActivities} from '../apps/room3d/gaming.js';
import {layoutRoom} from '../apps/room3d/layout.js';
import {walkingMap,findWalkPath} from '../apps/room3d/navigation.js';
import {wallPlacementError} from '../apps/room3d/wallMount.js';
const catalog=[...data,...BUILDING_ASSETS];
const piece=(assetId:string,patch={})=>({id:crypto.randomUUID(),assetId,x:0,y:.15,z:0,rotation:0,color:null,stored:false,...patch});
describe('larger room footprint and visible neighbors',()=>{
 it('enlarges both floor axes by 1.5 and allows furniture/walking in the new space',()=>{
  expect(ROOM_STEP.x/6.2).toBeCloseTo(1.5);expect(ROOM_STEP.z/5.3).toBeCloseTo(1.5);
  const h=createHome(catalog),r=h.rooms[0];r.items=[];
  const table=piece('table',{x:3.5,z:2.6});expect(placementError(table,r,catalog)).toBe('');
  expect(placementError({...table,x:ROOM_HALF.x},r,catalog)).not.toBe('');
  expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[3.6,2.8])).not.toBeNull();
  expect(layoutRoom(h,r,catalog).floorCells).toEqual([[-4.65,-3.975,4.65,3.975]]);
 });
 it('shows closed adjacent rooms without merging them or allowing passage, excluding other floors',()=>{
  const h=createHome(catalog),a=h.rooms[0];a.items=[];const b=addRoom(h,'right');addRoom(h,'up');
  expect(displayRooms(h,a).map(r=>r.id)).toEqual([a.id,b.id]);expect(roomGroups(h,catalog)).toHaveLength(3);
  expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).toBeNull();
  setBoundary(h,a.id,'right',{kind:'open'},catalog);expect(findWalkPath(walkingMap(h,0,catalog),[0,0],[ROOM_STEP.x,0])).not.toBeNull();
 });
 it('migrates old perimeter walls, doors and windows exactly once while preserving furniture clusters',()=>{
  const h=createHome(catalog);delete h.roomSizeVersion;const r=h.rooms[0];r.items=gamingPreset('stream',catalog);
  const originalFurniture=structuredClone(r.items);r.boundaries={back:{kind:'wall_high',door:{kind:'arch',at:.6,width:2}}};
  r.items.push(piece('wall_fence',{x:3.1,rotation:90,length:5.3}));
  r.items.push(piece('wooden_window',{x:-2.80,z:.3,y:2,rotation:90,color:'#91C9F4'}));
  const original=structuredClone(h),next=validateHome(h,catalog),nr=next.rooms[0];
  expect(h).toEqual(original);expect(next.roomSizeVersion).toBe(2);expect(validateHome(next,catalog)).toEqual(next);
  expect(nr.items.slice(0,originalFurniture.length)).toEqual(originalFurniture);expect(gamingActivities(nr,catalog).find(a=>a.kind==='stream')?.reason).toBe('');
  const wall=nr.items.find(i=>i.assetId==='wall_fence')!,win=nr.items.find(i=>i.assetId==='wooden_window')!;
  expect(buildingEdge(wall)).toBe('right');expect(wall.length).toBeCloseTo(7.95);expect(nr.boundaries!.back!.door!.at).toBeCloseTo(.9);expect(nr.boundaries!.back!.door!.width).toBe(2);
  expect(win.stored).toBe(false);expect(win.color).toBe('#91C9F4');expect(wallPlacementError(win,catalog.find(a=>a.id==='wooden_window'),nr,catalog)).toBe('');
 });
 it('preserves a complete loose partition when migrating old joined rooms',()=>{
  const h=createHome(catalog);delete h.roomSizeVersion;const a=h.rooms[0];a.items=[];addRoom(h,'right');setBoundary(h,a.id,'right',{kind:'open'},catalog);
  a.items.push(piece('wall_high',{x:3.1,length:5.3,rotation:90}));const next=validateHome(h,catalog);expect(roomGroups(next,catalog)).toHaveLength(2);
  for(const edge of Object.values(ROOM_EDGES))expect(Math.abs(edge.at)).toBeLessThanOrEqual(ROOM_HALF.x);
 });
});
