import {ROOM_HALF,MAX_BUILDING_LENGTH} from '../apps/room3d/dimensions.js';
import {describe,it,expect} from 'vitest';
import furniture from '../public/room3d/catalog.json';
import {BUILDING_ASSETS,ROOM_EDGES,placeBuildingOnEdge,snapBuildingToEdge,exteriorWallRemainders} from '../apps/room3d/building.js';
import {createBuildingTemplates} from '../apps/room3d/buildingMeshes.js';
import {createHome,findPlace,placementError,moveFurniture,validateHome,clone} from '../apps/room3d/model.js';
import * as T from 'three';
const catalog=[...furniture,...BUILDING_ASSETS];
const high=catalog.find(a=>a.id==='wall_high')!;
describe('room building segments',()=>{
 it('places walls on all four outer edges while furniture stays on the floor',()=>{
  const r=createHome(catalog).rooms[0];r.items=[];const wall=findPlace(high,r,catalog);
  for(const [key,edge] of Object.entries(ROOM_EDGES)){
   const next=placeBuildingOnEdge(wall,key);expect(next[edge.axis]).toBe(edge.at);expect(next.rotation).toBe(edge.rotation);expect(placementError(next,r,catalog)).toBe('');
   const near={...next,[edge.axis]:edge.at*.96};expect(snapBuildingToEdge(near)).toEqual(next);
  }
  const table=findPlace(furniture.find(a=>a.id==='table')!,r,catalog);expect(placementError({...table,z:ROOM_HALF.z},r,catalog)).toContain('地板');
 });
 it('replaces only the occupied exterior interval and restores it when moved or stored',()=>{
  const r=createHome(catalog).rooms[0];r.items=[];
  const wall=placeBuildingOnEdge({...findPlace(high,r,catalog),assetId:'wall_fence',length:2,x:0},'back');
  expect(exteriorWallRemainders([wall],catalog)).toEqual({back:[[-ROOM_HALF.x,-1],[1,ROOM_HALF.x]]});
  expect(exteriorWallRemainders([{...wall,stored:true}],catalog)).toEqual({});
  expect(exteriorWallRemainders([{...wall,z:0}],catalog)).toEqual({});
  const next=placeBuildingOnEdge({...wall,id:'second',x:2},'back');
  expect(exteriorWallRemainders([wall,next],catalog)).toEqual({back:[[-ROOM_HALF.x,-1],[3,ROOM_HALF.x]]});
 });
 it('uses adjustable length for rotated bounds and furniture collisions',()=>{
  const r=createHome(catalog).rooms[0];r.items=[];
  const wall={...findPlace(high,r,catalog),x:0,z:0,length:4};r.items.push(wall);
  expect(placementError({...wall,x:ROOM_HALF.x-1.5},r,catalog)).toContain('四周');
  expect(placementError({...wall,rotation:90,z:ROOM_HALF.z-1.5},r,catalog)).toContain('四周');
  const table={...findPlace(furniture.find(a=>a.id==='table')!,{...r,items:[]},catalog),x:1.6,z:0};
  expect(placementError(table,r,catalog)).toContain('碰到');
  expect(placementError(table,{...r,items:[{...wall,length:1.2}]},catalog)).toBe('');
 });
 it('allows wall junctions but avoids duplicate parallel walls',()=>{
  const r=createHome(catalog).rooms[0];r.items=[];
  const wall={...findPlace(high,r,catalog),x:0,z:0};r.items.push(wall);
  expect(placementError({...wall,id:'copy'},r,catalog)).toContain('已有墙段');
  expect(placementError({...wall,id:'join',x:1.2},r,catalog)).toBe('');
  expect(placementError({...wall,id:'turn',rotation:90,x:.6,z:.6},r,catalog)).toBe('');
 });
 it('switches types in place, keeps length in saved layouts, rejects invalid lengths atomically',()=>{
  const s=createHome(catalog),r=s.rooms[0];r.items=[];
  const wall={...findPlace(high,r,catalog),length:2.4};r.items.push(wall);
  moveFurniture(r,wall.id,{assetId:'wall_fence'},catalog);
  expect(r.items[0]).toMatchObject({...wall,assetId:'wall_fence'});
  expect(validateHome(JSON.parse(JSON.stringify(s)),catalog)).toEqual(s);
  const before=clone(r);expect(()=>moveFurniture(r,wall.id,{length:MAX_BUILDING_LENGTH+1},catalog)).toThrow('长度');expect(r).toEqual(before);
  for(const length of [NaN,.1,MAX_BUILDING_LENGTH+1]){const bad=clone(s);bad.rooms[0].items[0].length=length;expect(()=>validateHome(bad,catalog)).toThrow('长度');}
 });
 it('builds wall heights matching the room and thin open fences with shared templates',()=>{
  const roots=createBuildingTemplates();
  for(const root of roots){const asset=catalog.find(a=>a.id===root.userData.assetId)!;const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());expect(size.x).toBeCloseTo(1.2,2);expect(size.y).toBeLessThanOrEqual(asset.size[1]+.001);expect(root.children).toHaveLength(2);root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});}
 });
});
