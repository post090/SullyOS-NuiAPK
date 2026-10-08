import {describe,it,expect} from 'vitest';
import catalog from '../public/room3d/catalog.json';
import {createHome,addRoom} from '../apps/room3d/model.js';
import {snapToWall} from '../apps/room3d/wallMount.js';
import {windowDaylightSources} from '../apps/room3d/windowDaylight.js';
import {ROOM_HALF,ROOM_STEP} from '../apps/room3d/dimensions.js';
const asset=catalog.find(a=>a.id==='wooden_window')!;
function put(r:any,x:number,z:number,id='window'){const w=snapToWall({id,assetId:asset.id,x,y:2,z,rotation:0,color:null,stored:false},asset,r,catalog);r.items.push(w);return w;}
function sources(h:any,anchor=h.rooms[0],ids=h.rooms.map((r:any)=>r.id)){return windowDaylightSources(h,anchor,catalog,new Set(ids));}
describe('exterior window daylight',()=>{
 it('points into the room and down for all four walls',()=>{
  for(const [x,z,rotation,axis,sign] of [[0,-ROOM_HALF.z,0,2,1],[-ROOM_HALF.x,0,90,0,1],[0,ROOM_HALF.z,180,2,-1],[ROOM_HALF.x,0,270,0,-1]]){
   const h=createHome(catalog),r=h.rooms[0];r.items=[];expect(put(r,x,z).rotation).toBe(rotation);const [s]=sources(h);expect(s.target[axis]-s.position[axis]).toBeCloseTo(sign*2.4);expect(s.target[1]).toBeLessThan(s.position[1]);expect(s.angle).toBeGreaterThan(0);
  }
 });
 it('ignores stored, unsupported, low-wall and undetailed windows',()=>{
  const h=createHome(catalog),r=h.rooms[0];r.items=[];const w=put(r,0,-ROOM_HALF.z);expect(sources(h)).toHaveLength(1);expect(sources(h,r,[])).toHaveLength(0);
  w.stored=true;expect(sources(h)).toHaveLength(0);w.stored=false;w.z=0;expect(sources(h)).toHaveLength(0);w.z=-ROOM_HALF.z;Object.assign(w,snapToWall(w,asset,r,catalog));r.boundaries={back:{kind:'wall_low'}};expect(sources(h)).toHaveLength(0);
 });
 it('removes exterior light when expansion makes that wall interior',()=>{
  const h=createHome(catalog),r=h.rooms[0];r.items=[];put(r,0,-ROOM_HALF.z);expect(sources(h)).toHaveLength(1);addRoom(h,'back');expect(sources(h)).toHaveLength(0);
 });
 it('rebases sources with the active room, prioritizes it, and excludes other floors',()=>{
  const h=createHome(catalog),r=h.rooms[0];r.items=[];put(r,0,-ROOM_HALF.z,'a');const b=addRoom(h,'right');b.items=[];put(b,0,-ROOM_HALF.z,'b');const s=sources(h,b);expect(s.map((v:any)=>v.id)).toEqual(['b','a']);expect(s[1].position[0]).toBeCloseTo(-ROOM_STEP.x);b.level=1;expect(sources(h,r).map((v:any)=>v.id)).toEqual(['a']);
 });
});
