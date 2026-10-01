import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider } from '../../context/OSContext';
import { DB } from '../../utils/db';
import { SARGachaOverlay } from '../../apps/vrWorld/SARGacha';
import { SARModuleShopOverlay } from '../../apps/vrWorld/SARModuleShop';
import { createFishingMarketState, FISHING_MARKET_STORAGE_KEY } from '../../utils/vrWorld/fishingMarket';
import { createSARModuleShopState, SAR_MODULE_SHOP_STORAGE_KEY } from '../../utils/vrWorld/sarModuleShop';
if (!localStorage.getItem(FISHING_MARKET_STORAGE_KEY)) {
    localStorage.setItem(FISHING_MARKET_STORAGE_KEY, JSON.stringify({ ...createFishingMarketState(42), accounts: { user: 200, friend: 500 } }));
    localStorage.setItem(SAR_MODULE_SHOP_STORAGE_KEY, JSON.stringify(createSARModuleShopState(new Date(), () => .2)));
}
function Fixture() {
    const [page,setPage]=useState(new URLSearchParams(location.search).get('open')||'menu');
    return page==='gacha'?<SARGachaOverlay onClose={()=>setPage('menu')}/>:page==='shop'?<SARModuleShopOverlay npcEnabled={false} onClose={()=>setPage('menu')}/>:<div><button onClick={()=>setPage('gacha')}>打开抽卡</button><button onClick={()=>setPage('shop')}>打开商店</button></div>;
}
async function boot() {
    const characters = await DB.getAllCharacters();
    if (!characters.some(char=>char.id==='commerce-char')) await DB.saveCharacter({id:'commerce-char',name:'商店测试员',avatar:'',systemPrompt:'仅供本地界面测试。',vrState:{enabled:true,activityMode:'manual',intervalMinutes:120,currentRoom:'living'}} as any);
    createRoot(document.getElementById('root')!).render(<OSProvider><Fixture/></OSProvider>);
}
void boot();
