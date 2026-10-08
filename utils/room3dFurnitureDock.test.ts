import {describe,it,expect} from 'vitest';
import data from '../public/room3d/catalog.json';
import {createHome,moveFurniture,previewFurniture,validateHome,addRoom,placementError} from '../apps/room3d/model.js';
import {gamingPreset,gamingActivities} from '../apps/room3d/gaming.js';
import {dockCandidates,dockSlots,furnitureGroup} from '../apps/room3d/furnitureDock.js';
import {moveInHome} from '../apps/room3d/layout.js';
import {setBoundary} from '../apps/room3d/topology.js';
import {ROOM_STEP} from '../apps/room3d/dimensions.js';
const catalog=data;
function setup(){const h=createHome(catalog),r=h.rooms[0];r.items=gamingPreset('computer',catalog);return {h,r,desk:r.items.find(i=>i.assetId==='gaming_desk')!,chair:r.items.find(i=>i.assetId==='gaming_chair')!};}
describe('table and chair magnetic grouping',()=>{
 it('snaps near the calibrated computer slot, then moves and rotates the full group',()=>{
  const {h,r,desk,chair}=setup();chair.dockId=null;chair.dockSlot=null;const desired={...chair};chair.x+=.4;chair.z+=.1;chair.rotation=0;
  moveFurniture(r,chair.id,{x:chair.x},catalog);const snapped=r.items.find(i=>i.id===chair.id)!;expect(snapped.x).toBeCloseTo(desired.x,10);expect(snapped.z).toBeCloseTo(desired.z,10);expect(snapped).toMatchObject({rotation:180,dockId:desk.id,dockSlot:'front'});
  for(const rotation of [90,180,270,0]){moveFurniture(r,desk.id,{rotation,x:.2,z:-.5},catalog);expect(gamingActivities(r,catalog).find(a=>a.kind==='computer')?.reason).toBe('');expect(furnitureGroup(r,desk.id)).toHaveLength(5);}
  expect(validateHome(h,catalog)).toEqual(h);
 });
 it('keeps previews reversible and rejects a whole group hitting a wall',()=>{
  const {r,desk}=setup(),before=structuredClone(r);const preview=previewFurniture(r,desk.id,{rotation:90});expect(r).toEqual(before);expect(preview.items.find(i=>i.dockId===desk.id)?.rotation).toBe(270);
  expect(()=>moveFurniture(r,desk.id,{x:3.2},catalog)).toThrow();expect(r).toEqual(before);
 });
 it('detaches a dragged-away chair and supports explicitly disabling/re-enabling snap',()=>{
  const {r,desk,chair}=setup();moveFurniture(r,chair.id,{z:chair.z+.9},catalog);const free=r.items.find(i=>i.id===chair.id)!;expect(free.dockId).toBeNull();const pose={...free};
  moveFurniture(r,desk.id,{x:-.5},catalog);expect(r.items.find(i=>i.id===chair.id)).toEqual(pose);
  const target=dockSlots(r.items.find(i=>i.id===desk.id),free,r,catalog)[0];moveFurniture(r,chair.id,{...target,dockDisabled:true},catalog);expect(r.items.find(i=>i.id===chair.id)?.dockId).toBeNull();
  moveFurniture(r,chair.id,{dockDisabled:false},catalog);expect(r.items.find(i=>i.id===chair.id)?.dockId).toBe(desk.id);
 });
 it('does not steal occupied slots or attach sofas and display cabinets',()=>{
  const {r,chair,desk}=setup(),second={...chair,id:'second',dockId:null,dockSlot:null};expect(dockCandidates(second,r,catalog)).toHaveLength(0);
  expect(dockCandidates({...second,assetId:'petal_sofa'},r,catalog,Infinity)).toHaveLength(0);
  expect(dockSlots({...desk,assetId:'media_cabinet'},second,r,catalog)).toHaveLength(0);
 });
 it('supports free sides of round tables and rejects blocked snaps',()=>{
  const h=createHome(catalog),r=h.rooms[0],table=r.items.find(i=>i.assetId==='table')!;r.items=[table];const chair={id:'c',assetId:'chair',x:0,y:.15,z:0,rotation:0,color:null,stored:false};
  const slots=dockSlots(table,chair,r,catalog);expect(slots).toHaveLength(4);for(const slot of slots)expect(placementError(slot,r,catalog)).toBe('');
  r.items.push({...chair,...slots[0],x:slots[0].x+.1,z:slots[0].z+.1,dockId:null,dockSlot:null});moveFurniture(r,'c',{},catalog);expect(r.items[1].dockId).toBe(table.id);
 });
 it('keeps chair and tabletop supports together across an open room seam',()=>{
  const {h,r,desk}=setup(),other=addRoom(h,'right');setBoundary(h,r.id,'right',{kind:'open'},catalog);moveInHome(h,r,desk.id,{x:ROOM_STEP.x},catalog);
  expect(r.items).toHaveLength(0);expect(other.items).toHaveLength(5);expect(other.items.find(i=>i.dockId)?.dockId).toBe(desk.id);expect(validateHome(h,catalog)).toEqual(h);
 });
 it('adopts exact older layouts without movement and rejects broken or duplicate saved links',()=>{
  const {h,r,desk,chair}=setup();delete chair.dockId;delete chair.dockSlot;const before=structuredClone(h),next=validateHome(h,catalog);expect(h).toEqual(before);expect(next.rooms[0].items.find(i=>i.id===chair.id)).toMatchObject({...chair,dockId:desk.id});
  const broken=structuredClone(next);broken.rooms[0].items.find(i=>i.id===chair.id)!.dockId=chair.id;expect(()=>validateHome(broken,catalog)).toThrow('组合');
  const duplicate=structuredClone(next);duplicate.rooms[0].items.push({...next.rooms[0].items.find(i=>i.id===chair.id)!,id:'duplicate'});expect(()=>validateHome(duplicate,catalog)).toThrow('重复');
 });
});
