import {ROOM_HALF} from '../apps/room3d/dimensions.js';
import {describe,it,expect} from 'vitest';
import {wateringSpot} from '../apps/room3d/watering.js';
import {moveFurniture} from '../apps/room3d/model.js';
import catalog from '../public/room3d/catalog.json';
const plant={id:'p',assetId:'monstera',x:0,y:.15,z:0,rotation:0,stored:false,color:null};
const room=(items:any[]=[{...plant}])=>({id:'r',items});
const blocker=(id:string,x:number,z:number)=>({id,assetId:'block',x,y:.15,z,rotation:0,stored:false});
const assets=[...catalog,{id:'block',surface:'floor',size:[.7,2,.7],boxes:[[-.35,0,-.35,.35,2,.35]]}];
describe('plant watering clearance',()=>{
 it('tries all four sides, then reports no space',()=>{
  const r=room(),spots=[[0,1.15],[1.2,0],[0,-1.15],[-1.2,0]];
  for(let i=0;i<4;i++){expect(wateringSpot(r,assets,'p')?.side).toBe(['front','right','back','left'][i]);r.items.push(blocker('b'+i,...spots[i] as [number,number]));}
  expect(wateringSpot(r,assets,'p')).toBeNull();
 });
 it('includes the head, floor edges, storage, and rotation',()=>{
  const r=room([{...plant,x:ROOM_HALF.x-.9,z:ROOM_HALF.z-.85,rotation:90}]);const p=wateringSpot(r,assets,'p');expect(p).not.toBeNull();expect(['back','left']).toContain(p.side);
  r.items[0].stored=true;expect(wateringSpot(r,assets,'p')).toBeNull();expect(wateringSpot(room(),assets,'missing')).toBeNull();
 });
 it('allows a rug under the action and rejects non-plants',()=>{
  expect(wateringSpot(room([{...plant},{id:'rug',assetId:'rug',x:0,y:.15,z:1,rotation:0}]),assets,'p')).not.toBeNull();
  expect(wateringSpot(room([{...plant,assetId:'daisy_table'}]),assets,'p')).toBeNull();
 });
 it('moves and rotates separate tabletop objects with the empty table',()=>{
  const table=catalog.find(a=>a.id==='daisy_table')!;
  const r=room([{...plant,id:'t',assetId:'daisy_table'},{...plant,id:'v',assetId:'daisy_vase',x:.3,y:.15+table.support!.height,supportId:'t'}]);
  moveFurniture(r,'t',{x:.5,rotation:90},catalog);expect(r.items[1].x).toBeCloseTo(.5);expect(r.items[1].z).toBeCloseTo(-.3);expect(r.items[1].supportId).toBe('t');
 });
});
