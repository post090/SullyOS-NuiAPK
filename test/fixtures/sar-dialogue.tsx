// Only open in isolated automated browser contexts: this fixture seeds local test progress.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OSProvider} from '../../context/OSContext';
import {SARFamiliarityDialog} from '../../apps/vrWorld/SARFamiliarityDialog';
import {SARCaianDialogue} from '../../apps/vrWorld/SARClubEvent';
import {createFishingMarketState,readFishingMarketState,saveFishingMarketState} from '../../utils/vrWorld/fishingMarket';
import {familiarityScene} from '../../utils/vrWorld/sarFamiliarity/catalog';
import {freshFamiliarity} from '../../utils/vrWorld/sarFamiliarity/storageTypes';
import {familiarityDay} from '../../utils/vrWorld/sarFamiliarity/state';

const params=new URLSearchParams(location.search),scene=familiarityScene(params.get('scene')||'C1-01'),npc=scene?.npc||'caian';
if(!params.has('resume')){
    const state={...createFishingMarketState(17),sarFamiliarity:freshFamiliarity()};
    const p=state.sarFamiliarity.npcs[npc];p.day=familiarityDay();p.offerId=null;
    if(scene&&!params.has('greeting')){
        p.pending={runId:'qa',sceneId:scene.id,nodeId:params.get('node')||scene.start,line:Number(params.get('line')||0),revision:0,startedAt:Date.now(),flags:{},drafts:{},userName:'小雨'};
        if(params.has('replay')){p.completed[scene.id]={at:Date.now(),flags:{}};delete p.pending;}
    }
    saveFishingMarketState(state);
}
// Position visual-only cases after the normal entry restart, without changing production behavior.
if(!params.has('resume')&&!params.has('replay')&&(params.has('node')||params.has('line'))){
    const position=()=>{
        const text=(window as any).render_game_to_text?.(),view=text?JSON.parse(text):{};
        if(view.mode!=='sar-familiarity'||view.busy||!view.scene){requestAnimationFrame(position);return;}
        const state=readFishingMarketState(),cursor=state.sarFamiliarity!.npcs[npc].pending!;
        cursor.userName='小雨';cursor.nodeId=params.get('node')||scene!.start;cursor.line=Number(params.get('line')||0);
        saveFishingMarketState(state);document.documentElement.dataset.qaPositioned='true';
    };
    requestAnimationFrame(position);
}
function Fixture(){
    const [closed,setClosed]=useState(false),close=()=>setClosed(true);
    if(closed)return <div>已离开对话</div>;
    return params.has('intro')?<SARCaianDialogue onClose={close} onComplete={close}/>:<OSProvider><SARFamiliarityDialog npc={npc} sceneId={params.has('replay')?scene?.id:undefined} onClose={close} onEditUserChibi={()=>{}}/></OSProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
