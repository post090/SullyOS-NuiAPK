import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SARCollectionView } from '../../apps/vrWorld/SARCollectionView';
import { readFishingMarketState } from '../../utils/vrWorld/fishingMarket';
import '../../apps/vrWorld/sar-hub.css';
const actors=[{id:'user',name:'小雨',kind:'user' as const},{id:'qa-visitor',name:'路过的角色',kind:'character' as const}];
function Fixture(){
    const [market]=useState(()=>readFishingMarketState()),[ownerId,setOwnerId]=useState('user'),[closed,setClosed]=useState(false),[replay,setReplay]=useState('');
    const back=useRef<(()=>boolean)|null>(null);
    const keyDown=(event:React.KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();if(replay)setReplay('');else if(!back.current?.())setClosed(true);}};
    return closed?<div className="qa-back">已返回随身仓库</div>:<section className="sar-hub-panel" onKeyDown={keyDown} role="dialog" aria-label="收集图鉴"><SARCollectionView market={market} owner={actors.find(actor=>actor.id===ownerId)!} actors={actors} onOwnerChange={setOwnerId} onClose={()=>setClosed(true)} backRef={back} onOpenFamiliarity={(npc,sceneId)=>{const w=window as typeof window&{qaLastReplay?:unknown};w.qaLastReplay={npc,sceneId};setReplay(`${npc}:${sceneId}`);}}/>{replay&&<div className="qa-callback" role="dialog" aria-label="回放入口"><p>{replay}</p><button onClick={()=>setReplay('')}>关闭回放入口</button></div>}</section>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
