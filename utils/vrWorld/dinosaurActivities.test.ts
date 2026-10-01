import { beforeEach, expect, it } from 'vitest';
import { createFishingMarketState, addCatchToState, type FishingCatch } from './fishingMarket';
import { ensureDinosaurGarden, editDino, editGardenProp, setGardenVisits, setGardenMap, gardenResidents } from './dinosaurGarden';
import { buildGardenActivities, gardenActivityAt, gardenStory, sampleGardenActivity } from './dinosaurActivities';
import { prepareGardenVisit, parseGardenVisit, applyGardenVisit } from './dinosaurCharacter';
import { readDinosaurGarden } from './dinosaurStorage';
import type { GardenMap, GardenPropKind } from './dinosaurTypes';
const user={id:'user',name:'我',kind:'user' as const},char={id:'noir',name:'Noir',kind:'character' as const};
const empty=():ReturnType<typeof createFishingMarketState>=>{
 const s=ensureDinosaurGarden(createFishingMarketState(99),user);
 return {...s,dinosaurGarden:{...s.dinosaurGarden!,maps:s.dinosaurGarden!.maps.map(m=>({...m,props:[]}))}};
};
const first=(s:ReturnType<typeof empty>)=>gardenResidents(s)[0].catchId;
beforeEach(()=>localStorage.clear());
it('a single sentence needs neither an action tag nor a target, and clearing it restores local activity',()=>{
 let s=empty(),id=first(s);
 s=editDino(s,user,id,{stage:{text:'等薄荷还自己一块饼干。'}});
 expect(s.dinosaurGarden!.toys[id].userStage).toMatchObject({text:'等薄荷还自己一块饼干。',byId:'user'});
 expect(s.dinosaurGarden!.toys[id].userStage.targetId).toBeUndefined();
 const original=s.dinosaurGarden!.toys[id].userStage;
 s=applyGardenVisit(setGardenVisits(s,true,user),char,parseGardenVisit(JSON.stringify({action:'stage',toyId:id,words:'饼干谈判还在继续。'}))!,prepareGardenVisit(setGardenVisits(s,true,user),char));
 expect(s.dinosaurGarden!.toys[id].userStage).toEqual(original);
 expect(gardenStory(s.dinosaurGarden!.toys[id])).toBe('饼干谈判还在继续。');
 s=editDino(s,user,id,{stage:{text:''}});
 const toy=s.dinosaurGarden!.toys[id],activity=buildGardenActivities(s.dinosaurGarden!.maps[0],[toy])[id];
 expect(gardenStory(toy,activity)).toBe(activity.text);
 expect(readDinosaurGarden(JSON.parse(JSON.stringify(s.dinosaurGarden)))).toEqual(s.dinosaurGarden);
});
it('assigns real affordances to nearby props and rotates the tent entrance with the prop',()=>{
 const map:GardenMap={id:'grassland',name:'草原',theme:'grassland',props:[]};
 for(const [kind,want] of Object.entries({tent:'nap',picnic:'snack',puddle:'splash',flowers:'sniff',tree:'leaves',stump:'perch'})){
  const m={...map,props:[{id:'p',kind:kind as GardenPropKind,x:0,z:0,rotation:0}]};
  expect(gardenActivityAt(m,{x:kind==='tree'?-1.4:0,z:kind==='tent'?1.4:kind==='stump'?0:.5,rotation:0}).kind).toBe(want);
 }
 const tent={...map,props:[{id:'t',kind:'tent' as const,x:0,z:0,rotation:Math.PI/2}]};
 expect(gardenActivityAt(tent,{x:1.4,z:0,rotation:0}).propId).toBe('t');
 expect(gardenActivityAt(tent,{x:-1.4,z:0,rotation:0}).propId).toBeUndefined();
});
it('walkable play mats can sit underneath a dinosaur while tents and other solid props cannot',()=>{
 let s=empty(),id=first(s),pose=s.dinosaurGarden!.toys[id].pose!;
 s=editGardenProp(s,user,{kind:'picnic',pose});
 expect(()=>editDino(s,user,id,{pose})).not.toThrow();
 expect(buildGardenActivities(s.dinosaurGarden!.maps[0],gardenResidents(s))[id].kind).toBe('snack');
 expect(()=>editGardenProp(empty(),user,{kind:'tent',pose})).toThrow();
 expect(readDinosaurGarden(JSON.parse(JSON.stringify(s.dinosaurGarden))).maps[0].props[0].kind).toBe('picnic');
});
it('all dinosaurs retain the exact saved position and facing, while reduced motion is still',()=>{
 let s=empty(),id=first(s),pose=s.dinosaurGarden!.toys[id].pose!;
 s=editGardenProp(s,user,{kind:'picnic',pose});
 const toy=s.dinosaurGarden!.toys[id],a=buildGardenActivities(s.dinosaurGarden!.maps[0],[toy])[id];
 for(const time of [0,5,12,21])expect(sampleGardenActivity(toy,a,time)).toMatchObject({x:pose.x,z:pose.z,rotation:pose.rotation,lift:0});
 const one=sampleGardenActivity(toy,a,0,true),two=sampleGardenActivity(toy,a,17,true);
 expect({...one,phase:0}).toEqual({...two,phase:0});
});
it('avoids neighbours and reserves each interaction prop once without mutating saved positions',()=>{
 let s=empty(),id=first(s);s=editDino(s,user,id,{pose:{x:0,z:-.6,slotId:'C3',rotation:0}});
 const catch2={...s.inventory[0],id:'other'} as FishingCatch;s=ensureDinosaurGarden(addCatchToState(s,catch2),user);
 s=editDino(s,user,'other',{pose:{x:1.3,z:-.6,slotId:'C4',rotation:0}});
 const map:GardenMap={...s.dinosaurGarden!.maps[0],props:[{id:'stump',kind:'stump',x:.65,z:-.6,rotation:0}]};
 const before=JSON.stringify(s),toys=gardenResidents(s),actions=buildGardenActivities(map,toys);
 const claims=Object.values(actions).map(a=>a.propId).filter(Boolean);expect(new Set(claims).size).toBe(claims.length);
 for(const toy of toys){const a=actions[toy.catchId];for(const other of toys.filter(t=>t!==toy))expect(Math.hypot(a.dock.x-other.pose!.x,a.dock.z-other.pose!.z)).toBeGreaterThanOrEqual(.9);}
 expect(JSON.stringify(s)).toBe(before);
});
it('uses map-specific shallow water and includes environment facts in character visits',()=>{
 const map:GardenMap={id:'coast',name:'海岸',theme:'coast',props:[]};
 expect(gardenActivityAt(map,{x:2.6,z:1.9,rotation:0}).kind).toBe('splash');
 expect(gardenActivityAt({...map,theme:'volcano'},{x:2.6,z:1.9,rotation:0}).kind).toBe('idle');
 const snapshot=prepareGardenVisit(setGardenVisits(empty(),true,user),char);
 expect(snapshot.prompt).toContain('environmentActivity');expect(snapshot.prompt).toContain('不必指定对象');
 expect(parseGardenVisit('{"action":"stage","toyId":"x","stage":"变成真的","words":"飞起来"}')).toBeNull();
});

it('a delayed sentence-only visit keeps the original map activity after the user changes maps',()=>{
 let s=empty(),id=first(s);s=editGardenProp(s,user,{kind:'picnic',pose:s.dinosaurGarden!.toys[id].pose!});s=setGardenVisits(s,true,user);
 const snapshot=prepareGardenVisit(s,char);s=setGardenMap(s,'coast');
 s=applyGardenVisit(s,char,{action:'stage',toyId:id,words:'留一块饼干给我。'},snapshot);
 expect(s.dinosaurGarden!.activeMapId).toBe('coast');expect(s.dinosaurGarden!.toys[id].stage.action).toBe('吃饭');
 expect(s.dinosaurGarden!.toys[id].mapId).toBe('grassland');
});

it('decorative scenery never promises an unsupported interaction; facing a tree matters',()=>{
 const map:GardenMap={id:'volcano',name:'测试',theme:'volcano',props:[]};
 for(const kind of ['house','sign','fence','volcano'] as const)expect(gardenActivityAt({...map,props:[{id:'p',kind,x:0,z:0,rotation:0}]},{x:-1.3,z:0,rotation:0}).kind).toBe('idle');
 const tree={...map,props:[{id:'t',kind:'tree' as const,x:0,z:0,rotation:0}]};
 expect(gardenActivityAt(tree,{x:-1.3,z:0,rotation:0}).kind).toBe('leaves');
 expect(gardenActivityAt(tree,{x:-1.3,z:0,rotation:Math.PI}).kind).toBe('idle');
});
it('animations articulate different body parts without changing confirmed anchors',()=>{
 const s=empty(),toy=gardenResidents(s)[0],map=s.dinosaurGarden!.maps[0];
 const samples=['picnic','puddle','flowers','stump'].map(kind=>{const a=gardenActivityAt({...map,props:[{id:'p',kind:kind as GardenPropKind,...toy.pose!}]},toy.pose!);return sampleGardenActivity(toy,a,2);});
 for(const motion of samples)expect(motion).toMatchObject({x:toy.pose!.x,z:toy.pose!.z,rotation:toy.pose!.rotation});
 expect(samples[0].head).not.toBe(0);expect(samples[1].feet).not.toBe(0);expect(samples[2].head).not.toBe(samples[0].head);expect(samples[3].tail).not.toBe(0);expect(samples[3].lift).toBe(.46);
});
