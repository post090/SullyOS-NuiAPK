import { expect, it } from 'vitest';
import { createFishingMarketState, type FishingMarketState } from './fishingMarket';
import { ensureDinosaurGarden, gardenResidents, editDino, setGardenMap, editGardenProp } from './dinosaurGarden';
import { beginGardenPlacement, moveGardenPlacement, turnGardenPlacement, previewGardenPlacement, confirmGardenPlacement, placementError } from './dinosaurPlacement';
const user={id:'user',name:'我',kind:'user' as const};
const state=():FishingMarketState=>{const s=ensureDinosaurGarden(createFishingMarketState(2),user);return {...s,dinosaurGarden:{...s.dinosaurGarden!,maps:s.dinosaurGarden!.maps.map(m=>({...m,props:[]}))}};};
it('previewing, turning and abandoning a dinosaur never changes storage or history',()=>{
 const s=state(),id=gardenResidents(s)[0].catchId,before=JSON.stringify(s);
 let d=beginGardenPlacement(s,'dino',id);d=moveGardenPlacement(d,{x:0,z:3.15,rotation:0});d=turnGardenPlacement(d,1);
 const preview=previewGardenPlacement(s,d);
 expect(preview.dinosaurGarden!.toys[id].pose).toEqual(d.pose);expect(d.pose).not.toEqual(s.dinosaurGarden!.toys[id].pose);
 expect(preview.dinosaurGarden!.events).toBe(s.dinosaurGarden!.events);expect(JSON.stringify(s)).toBe(before);
 const next=confirmGardenPlacement(s,user,d);expect(next.dinosaurGarden!.events).toHaveLength(s.dinosaurGarden!.events.length+1);expect(next.dinosaurGarden!.toys[id].pose).toEqual(d.pose);
 expect(()=>confirmGardenPlacement(next,user,d)).toThrow('新变化');
});
it('a new prop is only allocated on confirmation, including its final orientation',()=>{
 const s=state(),d=turnGardenPlacement(beginGardenPlacement(s,'prop','','puddle'),-1),before=JSON.stringify(s);
 const preview=previewGardenPlacement(s,d);expect(preview.dinosaurGarden!.maps[0].props[0].id).toBe('placement-preview');expect(JSON.stringify(s)).toBe(before);
 const next=confirmGardenPlacement(s,user,d),p=next.dinosaurGarden!.maps[0].props[0];expect(p.id).not.toBe(d.id);expect(p.rotation).toBe(d.pose.rotation);expect(next.dinosaurGarden!.events.length).toBe(s.dinosaurGarden!.events.length+1);
});
it('blocked positions can be previewed in red but cannot be confirmed',()=>{
 const s=state(),id=gardenResidents(s)[0].catchId;let d=beginGardenPlacement(s,'prop','','tree');d={...d,pose:s.dinosaurGarden!.toys[id].pose!};
 expect(placementError(s,d)).toContain('恐龙太近');expect(previewGardenPlacement(s,d).dinosaurGarden!.maps[0].props).toHaveLength(1);expect(()=>confirmGardenPlacement(s,user,d)).toThrow();
});
it('rejects concurrent edits, deleted props, changed map and changed catch owner',()=>{
 let s=state();const id=gardenResidents(s)[0].catchId,d=beginGardenPlacement(s,'dino',id);
 expect(()=>confirmGardenPlacement(editDino(s,user,id,{stage:{text:'新的便签'}}),user,d)).toThrow('新变化');
 expect(()=>confirmGardenPlacement(setGardenMap(s,'coast'),user,d)).toThrow('新变化');
 expect(()=>confirmGardenPlacement({...s,inventory:s.inventory.map(c=>c.id===id?{...c,ownerId:'other'}:c)},user,d)).toThrow('收藏状态');
 s=editGardenProp(s,user,{kind:'puddle',pose:{x:0,z:3.15,rotation:0}});const p=s.dinosaurGarden!.maps[0].props[0],pd=beginGardenPlacement(s,'prop',p.id);
 expect(()=>confirmGardenPlacement(editGardenProp(s,user,{id:p.id,remove:true}),user,pd)).toThrow();
});
it('moving a prop keeps its identity and updates only once',()=>{
 let s=editGardenProp(state(),user,{kind:'flowers',pose:{x:0,z:3.15,rotation:0}});const id=s.dinosaurGarden!.maps[0].props[0].id;
 const d=turnGardenPlacement(beginGardenPlacement(s,'prop',id),1),n=confirmGardenPlacement(s,user,d);expect(n.dinosaurGarden!.maps[0].props).toHaveLength(1);expect(n.dinosaurGarden!.maps[0].props[0].id).toBe(id);expect(n.dinosaurGarden!.revision).toBe(s.dinosaurGarden!.revision+1);
});
