import {it,expect} from 'vitest';
import catalog from '../public/room3d/catalog.json';
import {createHome} from '../apps/room3d/model.js';
import {createPetLife} from '../apps/room3d/petLife.js';
import {petBedtime,petSleepPose} from '../apps/room3d/petSleep.js';
function setup(assetId='show_bed'){
 const home=createHome(catalog);home.rooms[0].items=[{id:'bed',assetId,x:0,y:.15,z:0,rotation:0,stored:false,color:null}];let hour=23;
 const life=createPetLife({home:()=>home,catalog,getHour:()=>hour,actors:()=>[{id:'user',roomId:home.activeRoomId,x:3,z:2,busy:true}],random:()=>0});
 const p=life.adopt('pet_cat','团子');p.x=3;p.z=-2;
 const advance=(n:number)=>{for(let i=0;i<n*20;i++)life.step(.05);};
 return {home,life,p,advance,setHour:(n:number)=>hour=n};
}
it('uses overnight boundaries',()=>{expect([21,22,0,7,8].map(petBedtime)).toEqual([false,true,true,true,false]);});
it('walks to the bed, jumps up, sleeps until morning, then lands on the reserved floor point',()=>{
 const s=setup();s.life.step(.05);expect(s.life.runtime.get(s.p.id)?.scheduled).toBe(true);expect(s.life.data.events.some(e=>e.text.includes('睡下'))).toBe(false);
 s.advance(25);let r=s.life.runtime.get(s.p.id);expect(r.sleepStage).toBe('sleep');expect(petSleepPose(s.p,r)[1]).toBeCloseTo(1);expect(s.life.data.events.filter(e=>e.text.includes('睡下'))).toHaveLength(1);
 s.advance(40);expect(s.life.runtime.get(s.p.id)).toBe(r);s.setHour(9);s.advance(1);expect(s.life.runtime.get(s.p.id)?.sleepSpot).toBeUndefined();
});
it('prefers a nest, holds a single claim, and pauses while the app is inactive',()=>{
 const s=setup();s.home.rooms[0].items.push({id:'nest',assetId:'pet_rest_mat',x:-2.8,y:.15,z:-2,rotation:0,stored:false,color:null});s.life.reconcile();
 s.life.step(.05);expect(s.life.runtime.get(s.p.id).itemId).toBe('nest');const other=s.life.adopt('pet_cat','另一只');expect(s.life.candidates(other).some(a=>a.itemId==='nest')).toBe(false);
 const before=JSON.stringify(s.life.inspect());s.life.step(1,false);expect(JSON.stringify(s.life.inspect())).toBe(before);
});
it('descends before responding to a call, even if the user is lying down',()=>{
 const s=setup();s.advance(25);s.life.interact(s.p.id,'approach');expect(s.life.runtime.get(s.p.id).sleepStage).toBe('down');s.advance(1);expect(s.life.runtime.get(s.p.id).kind).toBe('approach');s.advance(.2);expect(s.life.runtime.get(s.p.id).kind).toBe('approach');
});
it('does not start scheduled sleep when autonomy is off and wakes if furniture is removed',()=>{
 const s=setup();s.life.data.autonomy=false;s.advance(3);expect(s.life.runtime.get(s.p.id).sleepSpot).toBeUndefined();s.life.data.autonomy=true;s.advance(25);expect(s.life.runtime.get(s.p.id).sleepStage).toBe('sleep');s.home.rooms[0].items=[];s.advance(1);expect(s.life.runtime.get(s.p.id)?.sleepSpot).toBeUndefined();
});
it('uses rotated bed surfaces and excludes raised beds without an entry animation',()=>{
 const s=setup();s.home.rooms[0].items[0].rotation=90;s.life.reconcile();s.advance(25);const r=s.life.runtime.get(s.p.id);expect(r.sleepStage).toBe('sleep');expect(r.sleepSpot[0]).toBeCloseTo(1.05);
 const raised=setup('bedroom_loft');expect(raised.life.candidates(raised.p).some(a=>a.sleepSpot)).toBe(false);
});
