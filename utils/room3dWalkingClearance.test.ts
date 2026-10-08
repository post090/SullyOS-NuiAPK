import {describe,it,expect} from 'vitest';
import catalog from '../public/room3d/catalog.json';
import {createHome} from '../apps/room3d/model.js';
import {walkingMap,findWalkPath} from '../apps/room3d/navigation.js';

function maps(){
 const home=createHome(catalog);home.rooms[0].items=[];
 return [false,true].map(walkClearance=>walkingMap(home,0,catalog,{walkClearance}));
}
describe('walking clearance and ground click tolerance',()=>{
 it('allows landing on a rug while furniture above it still blocks walking',()=>{
  const home=createHome(catalog);home.rooms[0].items=[{id:'walk-rug',assetId:'bedroom_ref_rug',x:0,y:.15,z:0,rotation:0,stored:false}];
  const map=walkingMap(home,0,catalog,{walkClearance:true});
  expect(findWalkPath(map,[0,2.5],[0,1])).not.toBeNull();
  map.obstacles.push([-.5,.2,.5,.5,2,1.5]);
  expect(findWalkPath(map,[0,2.5],[0,1])).toBeNull();
 });
 it('admits a narrow but usable aisle without weakening the full standing check',()=>{
  const [strict,walking]=maps();
  for(const map of [strict,walking])map.obstacles.push([-2,.2,-2,-.7,3,2],[.7,.2,-2,2,3,2]);
  expect(strict.free(0,0)).toBe(false);expect(walking.free(0,0)).toBe(true);
  expect(findWalkPath(walking,[0,-2.5],[0,2.5])).not.toBeNull();
  expect(walking.free(.45,0)).toBe(false);
 });
 it('rounds head corners but still blocks torso furniture, walls and outside floors',()=>{
  const [strict,walking]=maps();
  for(const map of [strict,walking])map.obstacles.push([.55,.8,.55,1.5,2,1.5]);
  expect(strict.free(0,0)).toBe(false);expect(walking.free(0,0)).toBe(true);
  walking.obstacles.push([-.1,.2,-.1,.1,.5,.1]);expect(walking.free(0,0)).toBe(false);
  expect(walking.free(-4.6,0)).toBe(false);expect(walking.free(9,0)).toBe(false);
 });
 it('snaps only an explicitly tolerant click to nearby reachable space',()=>{
  const [,map]=maps();map.obstacles.push([.2,.2,-.5,1.5,3,.5]);
  const target=[0,0],start=[-2,0];
  expect(findWalkPath(map,start,target)).toBeNull();
  const path=findWalkPath(map,start,target,{targetRadius:.6});expect(path).not.toBeNull();
  const end=path!.at(-1)!;expect(Math.hypot(...end)).toBeLessThanOrEqual(.60001);expect(map.free(...end)).toBe(true);
  for(let i=1;i<path!.length;i++)for(let t=0;t<=1;t+=.05){const a=path![i-1],b=path![i];expect(map.free(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)).toBe(true);}
 });
 it('does not teleport from a blocked start or across a sealed wall',()=>{
  const [,map]=maps();map.obstacles.push([-.1,0,-4,.1,5,4]);
  expect(findWalkPath(map,[-2,0],[2,0],{targetRadius:.6})).toBeNull();
  expect(findWalkPath(map,[0,0],[2,0],{targetRadius:.6})).toBeNull();
 });
});

it('walks through a decorated 80cm aisle while still rejecting a solid wall',()=>{const [strict,walking]=maps();for(const map of [strict,walking])map.obstacles.push([-2,.2,-2,-.4,3,2],[.4,.2,-2,2,3,2]);expect(strict.free(0,0)).toBe(false);expect(findWalkPath(walking,[0,-2.5],[0,2.5])).not.toBeNull();walking.obstacles.push([-5,0,-.1,5,3,.1]);expect(findWalkPath(walking,[0,-1],[0,1])).toBeNull();});
