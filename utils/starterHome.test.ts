import {it,expect} from 'vitest';
import catalog from '../public/room3d/catalog.json';
import {createStarterHome,STARTER_ROOMS} from '../apps/room3d/starterHome.js';
import type {HomeAsset} from '../apps/room3d/model.js';
import {validateHome} from '../apps/room3d/model.js';
it('creates six furnished rooms in the requested three-storey layout',()=>{
 const home=createStarterHome(catalog,'aqua');
 expect(home.rooms.map(r=>[r.name,r.x,r.level])).toEqual(STARTER_ROOMS.map(r=>[r.name,r.x,r.level]));
 expect(home.rooms[0].items.some(i=>i.assetId==='living_ref_sofa')).toBe(true);
 expect(home.rooms[0].items.some(i=>i.assetId==='living_ref_window')).toBe(true);
 expect(home.rooms[5].items).toHaveLength(0);
 expect(home.rooms.slice(0,5).every(r=>r.items.length>0)).toBe(true);
 expect(new Set(home.rooms.flatMap(r=>[r.id,...r.items.map(i=>i.id)])).size).toBe(home.rooms.reduce((n,r)=>n+1+r.items.length,0));
 expect(validateHome(home,catalog as unknown as HomeAsset[]).rooms).toHaveLength(6);
 expect(home.rooms.every(r=>r.wall==='#eff5f5')).toBe(true);
});
