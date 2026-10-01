import {beforeEach,expect,it} from 'vitest';
import {addCatchToState,createFishingMarketState,createListing,ensureActorAccounts,readFishingMarketState,saveFishingMarketState,mutateFishingMarket,type FishingCatch,type MarketActor} from './fishingMarket';
import {ensureDinosaurGarden,editDino,findGardenSpace,gardenResidents,gardenSlots,gardenCatchAvailable,setGardenMap,setGardenVisits,giftDino,undoGardenVisit,editGardenProp,syncGardenToys} from './dinosaurGarden';
import {applyGardenVisit,prepareGardenVisit,parseGardenVisit} from './dinosaurCharacter';
import {activeGardenMap} from './dinosaurTypes';
import {DINO_GRID,snapDinoPose} from './dinosaurGrid';
import {collectSARLocalBackup,restoreSARLocalBackup} from './sarBackup';
const user:MarketActor={id:'user',name:'我',kind:'user'},char:MarketActor={id:'noir',name:'Noir',kind:'character'};
const now=1790000000000;
const caught=(id:string,owner=user,species='tyrannosaurus'):FishingCatch=>({id,speciesId:species,ownerId:owner.id,ownerName:owner.name,caughtAt:now,weather:'clear',weatherLabel:'晴',weatherSource:'simulated',sizeCm:12,quality:1,origin:{kind:'fished',actorId:owner.id,actorName:owner.name,at:now}});
const create=()=>ensureDinosaurGarden(ensureActorAccounts(createFishingMarketState(42),[user,char]),user,now);
const first=(s:ReturnType<typeof create>)=>gardenResidents(s)[0].catchId;
beforeEach(()=>localStorage.clear());

it('gives one real collection entry, with truthful gift provenance and no repeated starter minting',()=>{
  let s=create();expect(s.inventory).toHaveLength(1);expect(s.ledger[0].text).toContain('艾文');expect(s.ledger[0].text).not.toContain('钓到');
  s=ensureDinosaurGarden(s,user,now);expect(s.inventory).toHaveLength(1);
  s={...s,inventory:[],dinosaurGarden:undefined};s=ensureDinosaurGarden(s,user,now);expect(s.inventory).toHaveLength(0);
});
it('keeps different individuals independent and preserves their paint and original stage when moving maps',()=>{
  let s=create(),id=first(s);s=addCatchToState(s,caught('other'));s=ensureDinosaurGarden(s,user);
  s=editDino(s,user,id,{paint:{body:'#112233',accent:'#aabbcc'}});
  s=editDino(s,user,id,{stage:{action:'等待',text:'她坚信薄荷欠自己一块饼干。'}});
  const original=s.dinosaurGarden!.toys[id];s=setGardenMap(s,'coast');s=editDino(s,user,id,{pose:findGardenSpace(s,id)});
  expect(gardenResidents(s,'grassland')).toHaveLength(0);expect(gardenResidents(s,'coast')).toHaveLength(1);
  expect(s.dinosaurGarden!.toys[id]).toMatchObject({paint:original.paint,userStage:original.userStage,mapId:'coast'});
  expect(s.dinosaurGarden!.toys.other.paint).not.toEqual(original.paint);
});
it('caps each shared map at six across owners, while another map can hold a seventh toy',()=>{
  let s=create();for(let i=0;i<6;i++){s=addCatchToState(s,caught('d'+i,i%2?user:char));s=ensureDinosaurGarden(s,user);if(i<5)s=editDino(s,user,'d'+i,{pose:findGardenSpace(s,'d'+i)});}
  expect(gardenResidents(s)).toHaveLength(6);expect(()=>editDino(s,user,'d5',{pose:findGardenSpace(s,'d5')})).toThrow('最多放六只');
  s=setGardenMap(s,'coast');s=editDino(s,user,'d5',{pose:findGardenSpace(s,'d5')});expect(gardenResidents(s)).toHaveLength(1);expect(gardenResidents(s,'grassland')).toHaveLength(6);
  expect(s.inventory.find(c=>c.id==='d0')?.ownerId).toBe(char.id);
});
it('snaps fingers to fixed cells and eight headings; occupied and out-of-bounds moves are rejected',()=>{
  let s=create(),id=first(s);const spot=findGardenSpace(s,id);s=editDino(s,user,id,{pose:{x:spot.x+.07,z:spot.z+.04,rotation:.79}});
  expect(s.dinosaurGarden!.toys[id].pose).toMatchObject({x:spot.x,z:spot.z,rotation:Math.PI/4,slotId:spot.slotId});
  s=ensureDinosaurGarden(addCatchToState(s,caught('other')),user);
  expect(()=>editDino(s,user,'other',{pose:spot})).toThrow('太近');
  expect(()=>editDino(s,user,id,{pose:{x:88,z:0,rotation:0}})).toThrow('落点');
  expect(snapDinoPose({x:0,z:0,rotation:Math.PI*9})).toMatchObject({rotation:Math.PI});
});
it('Char can choose a grid cell, and a blocked model action never reports invented success',()=>{
  let s=setGardenVisits(create(),true,user),id=first(s),snapshot=prepareGardenVisit(s,char),cell=findGardenSpace(s,'new');
  expect(snapshot.prompt).toContain('隐藏棋盘');expect(snapshot.prompt).toContain('B3');
  const p=parseGardenVisit(JSON.stringify({action:'move',toyId:id,slotId:cell.slotId,words:'自己去要。'}))!;
  s=applyGardenVisit(s,char,p,snapshot);expect(s.dinosaurGarden!.toys[id].pose?.slotId).toBe(cell.slotId);
  expect(s.dinosaurGarden!.events.at(-1)?.words).toBe('自己去要。');
  const invalid=parseGardenVisit('{"action":"move","toyId":"x","slotId":"Z999","words":"飞走"}');expect(invalid).toBeNull();
  expect(parseGardenVisit('{"action":"sell","words":"全部卖了"}')).toBeNull();
});
it('fixed coastal landmarks block touch placement, props, and character moves while other maps keep their cells',()=>{
  let s=setGardenVisits(create(),true,user),id=first(s);
  expect(gardenSlots(s,id).find(c=>c.id==='E1')?.available).toBe(true);
  s=setGardenMap(s,'coast');
  const underUmbrella={...DINO_GRID.find(c=>c.id==='E1')!,slotId:'E1',rotation:0};
  expect(gardenSlots(s,id).find(c=>c.id==='E1')?.available).toBe(false);
  expect(()=>editDino(s,user,id,{pose:underUmbrella})).toThrow('场景摆设');
  expect(()=>editGardenProp(s,user,{kind:'rock',pose:underUmbrella})).toThrow('场景摆设');
  s=editDino(s,user,id,{pose:findGardenSpace(s,id)});
  expect(()=>applyGardenVisit(s,char,{action:'move',toyId:id,slotId:'E1',words:'去伞边。'},prepareGardenVisit(s,char))).toThrow('场景摆设');
  expect(gardenResidents(s)).toHaveLength(1);
});
it('Char appends a signed stage, preserves user originals, and undo appends history',()=>{
  let s=setGardenVisits(create(),true,user),id=first(s);s=editDino(s,user,id,{stage:{action:'等待',text:'原来的饼干债务'}});
  const old=s.dinosaurGarden!.toys[id];s=applyGardenVisit(s,char,{action:'stage',toyId:id,stage:'吵架',words:'谈判破裂。'},prepareGardenVisit(s,char));
  const event=s.dinosaurGarden!.events.at(-1)!;expect(s.dinosaurGarden!.toys[id]).toMatchObject({userStage:old.userStage,stage:{byId:char.id,text:'谈判破裂。'}});
  s=undoGardenVisit(s,event.id,user);expect(s.dinosaurGarden!.toys[id].stage).toEqual(old.stage);expect(s.dinosaurGarden!.events.some(e=>e.id===event.id)).toBe(true);expect(s.dinosaurGarden!.events.at(-1)?.undoOf).toBe(event.id);
  expect(()=>undoGardenVisit(s,event.id,user)).toThrow();
});
it('rejects stale changes, fixed toys and switched-off visits; fixed toys still accept comments',()=>{
  let s=setGardenVisits(create(),true,user),id=first(s),snapshot=prepareGardenVisit(s,char),plan={action:'stage' as const,toyId:id,stage:'等待' as const,words:'等你'};
  s=editDino(s,user,id,{name:'新名字'});expect(()=>applyGardenVisit(s,char,plan,snapshot)).toThrow('新变化');
  s=editDino(s,user,id,{fixed:true});snapshot=prepareGardenVisit(s,char);expect(()=>applyGardenVisit(s,char,plan,snapshot)).toThrow('固定');
  s=applyGardenVisit(s,char,{action:'comment',toyId:id,words:'坐得很稳。'},snapshot);expect(s.dinosaurGarden!.toys[id].fixed).toBe(true);
  s=setGardenVisits(s,false,user);expect(()=>applyGardenVisit(s,char,{action:'comment',words:'来了'},snapshot)).toThrow('关闭');
});
it('a map switch during generation keeps the action on its original map and preserves the viewed map',()=>{
  let s=setGardenVisits(create(),true,user),id=first(s),snapshot=prepareGardenVisit(s,char);s=setGardenMap(s,'coast');
  s=applyGardenVisit(s,char,{action:'stage',toyId:id,stage:'观察',words:'看看河边。'},snapshot);
  expect(s.dinosaurGarden!.activeMapId).toBe('coast');expect(s.dinosaurGarden!.toys[id].mapId).toBe('grassland');expect(s.dinosaurGarden!.events.at(-1)?.mapId).toBe('grassland');
});
it('listing and egg incubation exclude toys without deleting the collected identity',()=>{
  let s=create(),id=first(s),old=s.dinosaurGarden!.toys[id];s=createListing(s,user,s.inventory[0],100,'暂时挂板');s=syncGardenToys(s);
  expect(gardenCatchAvailable(s,id)).toBe(false);expect(gardenResidents(s)).toHaveLength(0);expect(s.dinosaurGarden!.toys[id].name).toBe(old.name);
  s=addCatchToState(s,{...caught('egg',user,'dinosaur-egg'),incubatingUntil:Date.now()+360000});s=ensureDinosaurGarden(s,user);expect(gardenCatchAvailable(s,'egg')).toBe(false);
});
it('gifting preserves appearance, ownership history and creates a factual receipt for the receiver',()=>{
  let s=create(),id=first(s);s=editDino(s,user,id,{name:'莓莓二号'});s=giftDino(s,user,id,char);
  expect(s.inventory[0].ownerId).toBe(char.id);expect(s.dinosaurGarden!.toys[id].name).toBe('莓莓二号');expect(s.dinosaurGarden!.toys[id].origin.actorName).toBe('艾文');expect(s.ledger.at(-1)?.participants).toContain(char.id);
});
it('map props are independent and malformed storage is not overwritten',async()=>{
  let s=create(),before=activeGardenMap(s.dinosaurGarden!).props;s=setGardenMap(s,'coast');s=editGardenProp(s,user,{id:activeGardenMap(s.dinosaurGarden!).props[0].id,remove:true});
  expect(s.dinosaurGarden!.maps.find(m=>m.id==='grassland')!.props).toEqual(before);saveFishingMarketState(s);
  const raw=JSON.stringify({...s,dinosaurGarden:{...s.dinosaurGarden,toys:{bad:{pose:'broken'}}}});localStorage.setItem('vr_fishing_market_v1',raw);
  await expect(mutateFishingMarket(s=>ensureDinosaurGarden(s,user))).rejects.toThrow('没有覆盖');expect(localStorage.getItem('vr_fishing_market_v1')).toBe(raw);
  saveFishingMarketState(s);await expect(mutateFishingMarket(s=>setGardenMap(s,'volcano'))).resolves.toMatchObject({dinosaurGarden:{activeMapId:'volcano'}});
});
it('backs up maps, individual paints, immutable notes and event history in the existing market backup',()=>{
  const s=create();saveFishingMarketState(s);const backup=collectSARLocalBackup();localStorage.clear();restoreSARLocalBackup(backup,{replaceMissing:false});expect(readFishingMarketState()).toEqual(s);
});
it('migrates old free placement into a unique hidden grid without losing original text or paint',()=>{
  const s=create(),id=first(s),g=s.dinosaurGarden!,map=activeGardenMap(g);
  const legacy={...s,dinosaurGarden:{...g,version:1,gridVersion:undefined,maps:undefined,activeMapId:undefined,props:map.props,theme:'grassland',toys:{...g.toys,[id]:{...g.toys[id],mapId:undefined,pose:{x:-1.57,z:1.42,rotation:-.4}}}}};
  localStorage.setItem('vr_fishing_market_v1',JSON.stringify(legacy));const migrated=readFishingMarketState().dinosaurGarden!;
  expect(migrated.version).toBe(2);expect(migrated.toys[id].pose?.slotId).toBeTruthy();expect(migrated.toys[id].paint).toEqual(g.toys[id].paint);expect(migrated.toys[id].userStage).toEqual(g.toys[id].userStage);expect(migrated.maps).toHaveLength(3);
});
