import { expect,it } from 'vitest';
import { addCatchToState,createFishingMarketState } from './fishingMarket';
import { ensureDinosaurGarden,gardenResidents,assertGardenPose,editDino,setGardenMap,findGardenSpace } from './dinosaurGarden';
import { DINO_GRID } from './dinosaurGrid';
import { buildGardenActivities,gardenActivityAt,INTERACTIVE_PROPS } from './dinosaurActivities';
import { activeGardenMap } from './dinosaurTypes';
import { planGardenPlay,previewGardenPlacement,confirmGardenPlacement,placementError } from './dinosaurPlacement';
const user={id:'user',name:'我',kind:'user' as const};
const fresh=()=>ensureDinosaurGarden(createFishingMarketState(42),user);
it('reproduces the old stump/grid mismatch and proposes a paired preview instead of a dead end',()=>{
 const s=fresh(),id=gardenResidents(s)[0].catchId,map=activeGardenMap(s.dinosaurGarden!),p=map.props.find(p=>p.kind==='stump')!;
 const direct=DINO_GRID.filter(c=>{const pose={...c,slotId:c.id,rotation:0};try{assertGardenPose(s,pose,id);return gardenActivityAt(map,pose).propId===p.id;}catch{return false;}});
 expect(direct).toHaveLength(0);
 const before=JSON.stringify(s),plan=planGardenPlay(s,id,p.id);expect(plan.reason).toBeUndefined();expect(plan.draft?.companionProp?.id).toBe(p.id);
 const preview=previewGardenPlacement(s,plan.draft!);expect(buildGardenActivities(activeGardenMap(preview.dinosaurGarden!),gardenResidents(preview))[id].kind).toBe('perch');
 expect(JSON.stringify(s)).toBe(before);expect(preview.dinosaurGarden!.events).toEqual(s.dinosaurGarden!.events);
 const next=confirmGardenPlacement(s,user,plan.draft!);expect(buildGardenActivities(activeGardenMap(next.dinosaurGarden!),gardenResidents(next))[id].propId).toBe(p.id);
 expect(next.dinosaurGarden!.maps[0].props.map(p=>p.id)).toEqual(map.props.map(p=>p.id));expect(next.dinosaurGarden!.toys[id].paint).toEqual(s.dinosaurGarden!.toys[id].paint);
 expect(()=>confirmGardenPlacement(next,user,plan.draft!)).toThrow('新变化');
});
it('every default interactive prop on all three maps has a playable confirmed arrangement',()=>{
 const seed=fresh(),id=gardenResidents(seed)[0].catchId;
 for(const map of seed.dinosaurGarden!.maps){const s=setGardenMap(seed,map.id);
   for(const prop of map.props.filter(p=>INTERACTIVE_PROPS.includes(p.kind))){
     const result=planGardenPlay(s,id,prop.id);expect(result.reason,`${map.id}/${prop.id}`).toBeUndefined();expect(placementError(s,result.draft!)).toBe('');
     const next=confirmGardenPlacement(s,user,result.draft!);expect(buildGardenActivities(activeGardenMap(next.dinosaurGarden!),gardenResidents(next))[id].propId).toBe(prop.id);
   }
 }
});
it('keeps a usable prop in place and searches all eight facings',()=>{
 let s=fresh();s={...s,dinosaurGarden:{...s.dinosaurGarden!,maps:s.dinosaurGarden!.maps.map(m=>({...m,props:m.props.filter(p=>p.id==='tree-b')}))}};const id=gardenResidents(s)[0].catchId,plan=planGardenPlay(s,id,'tree-b');expect(plan.reason).toBeUndefined();expect(plan.draft?.companionProp).toBeUndefined();
 const next=previewGardenPlacement(s,plan.draft!);expect(buildGardenActivities(activeGardenMap(next.dinosaurGarden!),gardenResidents(next))[id].kind).toBe('leaves');
});
it('explains occupied props and static collectibles rather than saying there is no nearby cell',()=>{
 let s=fresh();s=ensureDinosaurGarden(addCatchToState(s,{...s.inventory[0],id:'second',speciesId:'triceratops'}),user);
 expect(planGardenPlay(s,'second','picnic-a').reason).toContain('正在玩这个');
 s=ensureDinosaurGarden(addCatchToState(s,{...s.inventory[0],id:'egg',speciesId:'dinosaur-egg'}),user);
 expect(planGardenPlay(s,'egg','stump-a').reason).toContain('静态藏品');expect(planGardenPlay(s,'second','missing').reason).toContain('不在庭院');
});
it('does not move anyone or the prop to bypass six-resident capacity, and invalidates a stale paired draft',()=>{
 let s=fresh(),id=gardenResidents(s)[0].catchId;
 s={...s,dinosaurGarden:{...s.dinosaurGarden!,maps:s.dinosaurGarden!.maps.map(m=>({...m,props:m.props.filter(p=>p.kind==='stump')}))}};
 for(let i=0;i<6;i++){const key='new-'+i;s=ensureDinosaurGarden(addCatchToState(s,{...s.inventory[0],id:key,speciesId:'triceratops'}),user);if(i<5)s=editDino(s,user,key,{pose:findGardenSpace(s,key)});}
 const before=JSON.stringify(s);expect(planGardenPlay(s,'new-5','stump-a').reason).toContain('住满六只');expect(JSON.stringify(s)).toBe(before);
 const plan=planGardenPlay(fresh(),id,'stump-a');const changed=editDino(fresh(),user,id,{stage:{text:'新消息'}});expect(()=>confirmGardenPlacement(changed,user,plan.draft!)).toThrow('新变化');
});
