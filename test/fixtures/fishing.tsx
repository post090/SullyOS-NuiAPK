// Development-only fixture; Vite's production entry never imports it. No real API calls.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FishingMarketOverlay } from '../../apps/vrWorld/FishingMarketOverlay';
createRoot(document.getElementById('root')!).render(<FishingMarketOverlay initialEntry={new URLSearchParams(location.search).get('entry')==='board'?'board':'water'} characters={[]} userProfile={{name:'钓鱼测试员'} as any} onClose={()=>{}} onCharacterTrip={async()=>({ok:false,reason:'no-api'})}/>);
