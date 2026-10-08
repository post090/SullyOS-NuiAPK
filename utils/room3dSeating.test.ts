import {describe,it,expect} from 'vitest';
import {seatTransform,roomSeats} from '../apps/room3d/seating.js';
import {readFileSync} from 'node:fs';
import {createHome,validateHome,placementError} from '../apps/room3d/model.js';
const catalog=[{id:'sofa',name:'沙发',seats:[{id:'center',label:'中间',position:[.2,.63,.43],rotation:15}]}];
const item={id:'one',assetId:'sofa',x:1,y:.15,z:-1,rotation:90,stored:false};
const room={id:'room',items:[item]},selection={roomId:'room',itemId:'one',seatId:'center'};
describe('furniture-local seating',()=>{
 it('uses a reviewed cushion pose only for body 2, with its contact offset rotated with the seat',()=>{
  const assets=[{...catalog[0],id:'bedroom_ref_flower_pouf'}],r={...room,items:[{...item,assetId:assets[0].id}]};
  const classic=seatTransform(r,assets,selection)!,blank=seatTransform(r,assets,selection,true)!;
  expect(classic.pose).toBe('chair');expect(blank.pose).toBe('floor');
  expect(blank.position[0]-classic.position[0]).toBeCloseTo(Math.sin(blank.rotation)*.20);
  expect(blank.position[2]-classic.position[2]).toBeCloseTo(Math.cos(blank.rotation)*.20);
  expect(blank.height).toBeCloseTo(.60);
  expect(seatTransform(room,catalog,selection,true)!.pose).toBe('chair');
 });
 it('rotates and translates the seat with its furniture, including the facing offset',()=>{
  const seat=seatTransform(room,catalog,selection)!;
  expect(seat.position[0]).toBeCloseTo(1.43);expect(seat.position[1]).toBeCloseTo(.78);expect(seat.position[2]).toBeCloseTo(-1.2);expect(seat.rotation).toBeCloseTo(105*Math.PI/180);
  expect(seatTransform({...room,items:[{...item,x:2,rotation:180}]},catalog,selection)!.position[0]).toBeCloseTo(1.8);
 });
 it('releases a seat when stored, removed, switched to another room or replaced by an unconfigured asset',()=>{
  for(const changed of [{...room,id:'other'},{...room,items:[]},{...room,items:[{...item,stored:true}]},{...room,items:[{...item,assetId:'chair'}]}])expect(seatTransform(changed,catalog,selection)).toBeNull();
  expect(seatTransform(room,catalog,{...selection,seatId:'missing'})).toBeNull();
 });
 it('only offers explicitly reviewed seats on placed furniture, including duplicate instances',()=>{
  const seats=roomSeats({...room,items:[item,{...item,id:'two'},{...item,id:'stored',stored:true},{...item,id:'unknown',assetId:'chair'}]},catalog);
  expect(seats.map(s=>s.itemId)).toEqual(['one','two']);expect(seats.every(s=>s.seatId==='center')).toBe(true);
 });
});
describe('petal sofa sizes and older rooms',()=>{
 const shipped=JSON.parse(readFileSync('public/room3d/catalog.json','utf8'));
 it('provides separated left/right seats and a centered single seat',()=>{
  const double=shipped.find((a:any)=>a.id==='petal_sofa'),single=shipped.find((a:any)=>a.id==='petal_armchair');
  expect(double.seats.map((s:any)=>s.id)).toEqual(['left','right']);expect(double.seats[1].position[0]-double.seats[0].position[0]).toBeGreaterThan(1.8);
  expect(single.seats).toHaveLength(1);expect(single.seats[0].position[0]).toBe(0);expect(single.size[0]).toBeLessThan(double.size[0]);
 });
 it('keeps the old sofa placement now that the larger room has space',()=>{
  const state=createHome(shipped),room=state.rooms[0];room.items.push({id:'old-sofa',assetId:'petal_sofa',x:1.38,y:.15,z:-.433,rotation:0,stored:false,color:'#91C9F4'});
  expect(placementError(room.items.at(-1)!,room,shipped)).toBe('');const migrated=validateHome(state,shipped),next=migrated.rooms[0].items.find(i=>i.id==='old-sofa')!;
  expect(next.x).toBe(1.38);expect(next.color).toBe('#91C9F4');expect(next.stored).toBe(false);expect(placementError(next,migrated.rooms[0],shipped)).toBe('');expect(validateHome(migrated,shipped)).toEqual(migrated);
  expect(state.rooms[0].items.at(-1)!.x).toBe(1.38);
 });
});
