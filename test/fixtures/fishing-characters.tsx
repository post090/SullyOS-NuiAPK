// Development-only: real fishing/session/DB flow with a test-only model endpoint intercepted by QA.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FishingMarketOverlay } from '../../apps/vrWorld/FishingMarketOverlay';
import { runVRSession } from '../../utils/vrWorld/runSession';
import { DB } from '../../utils/db';
import { readFishingMarketState } from '../../utils/vrWorld/fishingMarket';
import { flushFishingDeliveries } from '../../utils/vrWorld/fishingDelivery';
const characters=[{id:'fish-a',name:'阿岚'},{id:'fish-b',name:'小舟'}].map(c=>({...c,systemPrompt:'保持自己的性格，语言为中文。',contextLimit:20,memoryPalaceEnabled:false,vrState:{enabled:true,intervalMinutes:120,currentRoom:'sar'}})) as any;
const userProfile={name:'钓鱼测试员'} as any;
async function boot(){
    for(const c of characters)await DB.saveCharacter(c);
    (window as any).fishingFixture={DB,readFishingMarketState,characters,flush:()=>flushFishingDeliveries(characters)};
    createRoot(document.getElementById('root')!).render(<FishingMarketOverlay characters={characters} userProfile={userProfile} onClose={()=>{}} onCharacterTrip={char=>runVRSession({
        char,characters,userProfile,apiConfig:{baseUrl:'https://fishing-model.invalid/v1',apiKey:'fixture',model:'fixture'} as any,groups:[],forcedRoom:'sar',forcedSARActivity:'fishing',manual:true,updateCharacter:async()=>{},
    })}/>);
}
void boot();
