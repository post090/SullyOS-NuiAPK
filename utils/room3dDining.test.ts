import {describe,it,expect} from 'vitest';
import catalog from '../public/room3d/catalog.json';
import {createHome,placementError,moveFurniture,validateHome,furnitureType} from '../apps/room3d/model.js';
import {diningPreset,diningActivities,placeDiningPreset,fridgeOpenError} from '../apps/room3d/dining.js';
import {dockCandidates} from '../apps/room3d/furnitureDock.js';
import {eatingHand} from '../apps/room3d/diningMotion.js';
import {furnishShowroom} from '../apps/room3d/showrooms.js';
import {furnitureInteractions} from '../apps/room3d/furnitureInteractions.js';
function dining(){const h=createHome(catalog);h.rooms[0].items=diningPreset(catalog);return h;}
describe('kitchen furniture interactions',()=>{
 it('offers eating on an existing showroom island, bench and breakfast without dock links',()=>{
  const r=createHome(catalog).rooms[0];r.items=[];furnishShowroom(r,'kitchen',catalog);const before=JSON.stringify(r);
  const activities=diningActivities(r,catalog);expect(activities).toHaveLength(2);expect(activities.every(a=>!a.reason)).toBe(true);expect(new Set(activities.map(a=>a.stationId)).size).toBe(2);expect(Math.hypot(activities[0].position[0]-activities[1].position[0],activities[0].position[2]-activities[1].position[2])).toBeCloseTo(1.7);
  for(const assetId of ['show_kitchen_island','show_kitchen_bench','kitchen_ref_breakfast']){
   const item=r.items.find(i=>i.assetId===assetId)!;
   expect(furnitureInteractions(r,catalog,item.id,{activities}).some(a=>a.kind==='eat'&&!a.reason)).toBe(true);
  }
  expect(JSON.stringify(r)).toBe(before);
  for(const angle of [90,180,270,0]){
   const turned=JSON.parse(before),t=angle*Math.PI/180;
   turned.items=turned.items.filter(i=>['show_kitchen_island','show_kitchen_bench','kitchen_ref_breakfast'].includes(i.assetId)).map(i=>({...i,x:Math.cos(t)*i.x+Math.sin(t)*i.z,z:-Math.sin(t)*i.x+Math.cos(t)*i.z,rotation:(i.rotation+angle)%360}));
   const meal=diningActivities(turned,catalog);expect(meal).toHaveLength(2);expect(meal[0].reason).toBe('');
  }
  const tray=r.items.find(i=>i.assetId==='kitchen_ref_breakfast')!;tray.stored=true;expect(diningActivities(r,catalog)[0].reason).toContain('托盘');tray.stored=false;
  const bench=r.items.find(i=>i.assetId==='show_kitchen_bench')!;bench.rotation=0;expect(diningActivities(r,catalog)).toHaveLength(0);
 });
 it('uses a pet category and a two-chair dining preset with reachable hands',()=>{
  expect(furnitureType(catalog.find(a=>a.id==='pet_bowls'))).toBe('pets');const h=dining(),r=h.rooms[0];
  expect(diningActivities(r,catalog)).toHaveLength(2);expect(diningActivities(r,catalog).every(a=>!a.reason)).toBe(true);expect(r.items.map(i=>placementError(i,r,catalog))).toEqual(['','','']);expect(validateHome(h,catalog).rooms).toEqual(h.rooms);
 });
 it('rotates/translates the table, chairs and meal poses together in four directions',()=>{
  const h=dining(),r=h.rooms[0],table=r.items[0];for(const rotation of [90,180,270,0]){moveFurniture(r,table.id,{rotation,x:.2,z:.1},catalog);expect(diningActivities(r,catalog).every(a=>!a.reason)).toBe(true);expect(r.items.slice(1).every(c=>c.dockId===table.id)).toBe(true);}
 });
 it('excludes a detached/stored chair, rejects a blocked table edge and tall mismatched seats',()=>{
  const h=dining(),r=h.rooms[0],chair=r.items[1];chair.stored=true;expect(diningActivities(r,catalog)).toHaveLength(1);chair.stored=false;delete chair.dockId;expect(diningActivities(r,catalog)).toHaveLength(1);
  const pose=diningActivities(r,catalog)[0],table=r.items[0];r.items.push({id:'blocking-vase',assetId:'dining_vase',x:pose.position[0],y:.15+1.03,z:-1.09,rotation:0,color:null,stored:false,supportId:table.id});expect(diningActivities(r,catalog)[0].reason).not.toBe('');
 });
 it('finds the empty docking slot and does not create a half preset in a full room',()=>{
  const h=dining(),r=h.rooms[0],chair=r.items.pop();delete chair.dockId;delete chair.dockSlot;expect(dockCandidates(chair,r,catalog)).toHaveLength(1);
  expect(()=>placeDiningPreset({...r,items:[{id:'obstacle',assetId:'huge',x:0,y:0,z:0,rotation:0,stored:false}]},[...catalog,{id:'huge',surface:'floor',size:[9,5,7],boxes:[[-4.5,0,-3.5,4.5,5,3.5]]}])).toThrow();
 });
 it('checks fridge opening clearance in four directions and preserves input',()=>{
  const h=createHome(catalog),r=h.rooms[0],f={id:'fridge',assetId:'kitchen_fridge',x:0,y:.15,z:0,rotation:0,color:null,stored:false};r.items=[f];
  for(const rotation of [0,90,180,270]){f.rotation=rotation;expect(fridgeOpenError(f,r,catalog)).toBe('');const a=rotation*Math.PI/180;r.items.push({id:'block',assetId:'kitchen_bin',x:Math.sin(a)*.8,y:.15,z:Math.cos(a)*.8,rotation:0,color:null,stored:false});expect(fridgeOpenError(f,r,catalog)).not.toBe('');r.items.pop();}
  f.rotation=0;f.z=3.3;expect(fridgeOpenError(f,r,catalog)).not.toBe('');
 });
 it('returns a bounded scoop-to-mouth trajectory without mutating hand rest poses',()=>{
  const rest=[.26,.56,.77];const before=[...rest];expect(eatingHand(rest,0,1)).toEqual(rest);expect(eatingHand(rest,1.2,1)).toEqual([.12,.85,.47]);expect(eatingHand(rest,2.6,1)).toEqual(rest);expect(rest).toEqual(before);
 });
});
