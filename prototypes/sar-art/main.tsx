import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SARClubStage,SARCaianDialogue} from '../../apps/vrWorld/SARClubEvent';
import {SARAivenDialogue} from '../../apps/vrWorld/SARAivenDialogue';
import {SARPortrait} from '../../apps/vrWorld/SARNpcArt';
import {SAR_EXPRESSIONS,type SARExpression} from '../../utils/vrWorld/sarArt';
import {sarRoomZoneAt} from '../../utils/vrWorld/sarRoomLayout';
import type {CharacterProfile} from '../../types';
import caian from '../../assets/sar/caian-chibi.png';
import aiven from '../../assets/sar/aiven-chibi.png';
import PortraitLayoutEditor from './PortraitLayoutEditor';

const visitors=[['sample-reader','示例访客一','cabinet',caian],['sample-fisher','示例钓客','fishing',aiven],['sample-player','示例访客二','garden',caian]].map(([id,name,sarActivity,img])=>({id,name,vrState:{enabled:true,currentRoom:'sar',sarActivity,chibi:{img,scale:1,offsetY:0,flip:false}}} as CharacterProfile));
function Preview(){
    const [dialogue,setDialogue]=useState<'caian'|'aiven'|null>(()=>{const who=new URLSearchParams(location.search).get('dialogue');return who==='caian'||who==='aiven'?who:null;}),[met,setMet]=useState(false),[action,setAction]=useState(''),[npcs,setNpcs]=useState(true);
    const params=new URLSearchParams(location.search),portraitWho=params.get('portrait')==='aiven'?'aiven':'caian';
    const [expression,setExpression]=useState<SARExpression>('normal');
    const open=(value:string)=>{setDialogue(null);setAction(value);};
    if(params.get('edit')==='portraits')return <PortraitLayoutEditor/>;
    Object.assign(window,{render_game_to_text:()=>JSON.stringify({mode:'sar-art',dialogue,action,npcs,line:document.querySelector('.sar-dialogue-panel p')?.textContent,cast:Array.from(document.querySelectorAll<HTMLElement>('.sar-dialogue-cast .sar-npc-portrait')).map(el=>({who:el.dataset.speaker,expression:el.dataset.expression,speaking:!!el.closest('.is-speaking'),loading:el.getAttribute('aria-busy')==='true'})),actors:Array.from(document.querySelectorAll<HTMLElement>('[data-actor-id]')).map(el=>({id:el.dataset.actorId,x:Number(el.dataset.footX),y:Number(el.dataset.footY),zone:el.dataset.zone,valid:sarRoomZoneAt(Number(el.dataset.footX),Number(el.dataset.footY))===el.dataset.zone})),facilities:Array.from(document.querySelectorAll<HTMLElement>('[data-facility]')).map(el=>el.dataset.facility)}),advanceTime:()=>Promise.resolve()});
    if(params.has('portrait'))return <div style={{height:'100dvh',background:'#171724',display:'flex',flexDirection:'column',paddingTop:30}}><div style={{flex:1,minHeight:0}}><SARPortrait who={portraitWho} expression={expression}/></div><div style={{display:'flex',flexWrap:'wrap',padding:15,gap:8}}>{SAR_EXPRESSIONS[portraitWho].map(e=><button key={e} style={{padding:10,background:'#eee',borderRadius:8}} onClick={()=>setExpression(e)}>{e}</button>)}</div></div>;
    return <>
        <SARClubStage npcEnabled={npcs} caianMet={met} occupants={visitors} onTalkToCaian={()=>setDialogue('caian')} onTalkToAiven={()=>setDialogue('aiven')} onSelectCharacter={char=>open(char.id)} onOpenGacha={()=>open('gacha')} onOpenCabinet={()=>open('cabinet')} onOpenModuleShop={()=>open('modules')} onOpenFishingMarket={open}/>
        <header style={{position:'absolute',top:12,left:16,pointerEvents:'none',color:'#78654a'}}><small style={{fontSize:8}}>美术联调 · 含示例访客</small><h1 style={{fontSize:16,margin:0}}>SAR 活动室</h1></header>
        <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',justifyContent:'center',gap:12,fontSize:10,color:'#77684f',background:'#fffdf4cc'}}><button onClick={()=>setNpcs(v=>!v)} style={{minHeight:30}}>NPC {npcs?'显示':'隐藏'}</button><output data-testid="last-action">{action}</output><a href="?edit=portraits">调整立绘</a><a href="/test/fixtures/kanata.html?npcs=show">进入完整彼方</a></div>
        {dialogue==='caian'&&<SARCaianDialogue onClose={()=>setDialogue(null)} onComplete={()=>{setMet(true);setDialogue(null);}}/>}
        {dialogue==='aiven'&&<SARAivenDialogue onClose={()=>setDialogue(null)} onOpen={open}/>}
    </>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
