import React from 'react';
import {createRoot} from 'react-dom/client';
import {DinosaurGarden} from '../../apps/vrWorld/dinosaur/DinosaurGarden';
import {createFishingMarketState,ensureActorAccounts,saveFishingMarketState,FISHING_MARKET_STORAGE_KEY,addCatchToState,readFishingMarketState,mutateFishingMarket} from '../../utils/vrWorld/fishingMarket';
import {ensureDinosaurGarden,editDino,findGardenSpace,setGardenMap,gardenResidents} from '../../utils/vrWorld/dinosaurGarden';
import {prepareGardenVisit,applyGardenVisit} from '../../utils/vrWorld/dinosaurCharacter';
import {DINO_CATALOG,createGardenMaps} from '../../utils/vrWorld/dinosaurCatalog';
import type {CharacterProfile,UserProfile} from '../../types';
const user={id:'user',name:'我',kind:'user' as const},sample={id:'sample-visitor',name:'示例来客',kind:'character' as const};
if(!localStorage.getItem(FISHING_MARKET_STORAGE_KEY)){
  let s=ensureDinosaurGarden(ensureActorAccounts(createFishingMarketState(20260909),[user,sample]),user);
  DINO_CATALOG.slice(1).forEach((d,i)=>{s=addCatchToState(s,{id:'sample-'+d.id,speciesId:d.id,ownerId:'user',ownerName:'我',caughtAt:Date.now(),weather:'clear',weatherLabel:'试玩赠礼',weatherSource:'simulated',quality:1,sizeCm:12,origin:{kind:'gift',actorName:'试玩盒子',at:Date.now()}});s=ensureDinosaurGarden(s,user);if(i<3)s=editDino(s,user,'sample-'+d.id,{pose:{...findGardenSpace(s,'sample-'+d.id,{x:i===2?-2.6:i%2?2:-1.6,z:i===2?-1.85:-1.4}),rotation:i===2?Math.PI/2:0}});});saveFishingMarketState(s);
}
// Upgrade only the clearly marked local art-demo collection. Never seed production catches.
if(!localStorage.getItem('clay-demo-maps-v2')){
  let s=ensureDinosaurGarden(readFishingMarketState(),user);
  if(s.seed===20260909&&s.inventory.every(c=>c.id.startsWith('sample-')||c.id==='clay-starter-20260909')){
    for(const [index,map] of ['coast','volcano'].entries()){
      s=setGardenMap(s,map);
      for(const c of s.inventory.filter(c=>!s.dinosaurGarden!.toys[c.id]?.pose).slice(0,4))s=editDino(s,user,c.id,{pose:findGardenSpace(s,c.id,{x:index?-.8:0,z:index?1:-1.5})});
    }
    saveFishingMarketState(setGardenMap(s,'grassland'));localStorage.setItem('clay-demo-maps-v2','1');
  }
}
{
  const s=readFishingMarketState(),g=s.dinosaurGarden;
  if(s.seed===20260909&&g&&g.maps.some(m=>m.artVersion!==3)){
    const defaults=createGardenMaps();
    saveFishingMarketState({...s,dinosaurGarden:{...g,revision:g.revision+1,maps:g.maps.map(m=>m.artVersion===3?m:{...m,artVersion:3,props:[...defaults.find(d=>d.id===m.id)!.props,...m.props.filter(p=>p.id.startsWith('prop_'))]})}});
  }
}
const char={id:sample.id,name:sample.name,vrState:{enabled:true}} as CharacterProfile;
createRoot(document.getElementById('root')!).render(<DinosaurGarden demo userProfile={{name:'我'} as UserProfile} characters={[char]} onClose={()=>location.reload()} onCharacterTrip={async()=>{
  const s=readFishingMarketState(),snapshot=prepareGardenVisit(s,sample),toy=gardenResidents(s).find(t=>!t.fixed);
  await mutateFishingMarket(fresh=>applyGardenVisit(fresh,sample,toy?{action:'stage',toyId:toy.catchId,stage:'等待',words:'试玩便签：它在等你把今天的故事接下去。'}:{action:'comment',words:'试玩便签：今天都摆得很认真。'},snapshot));return {ok:true};
}}/>);
