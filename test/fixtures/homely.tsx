import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OSProvider,OSPreviewProvider,useOS} from '../../context/OSContext';
import {MusicProvider,useMusic} from '../../context/MusicContext';
import HomelyHome from '../../components/os/HomelyHome';
import PhoneShell from '../../components/PhoneShell';
import {AppID,type CharacterProfile,type OSTheme} from '../../types';
import {testCharacter} from './room3d-test-character';
import {createStarterHome} from '../../apps/room3d/starterHome.js';
import {DB} from '../../utils/db';
import {getLocalDateKey} from '../../utils/localDate';
import type {HomeEditor} from '../../apps/room3d/editor';

const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=String(input);
 if(url.startsWith('/__homely_mock__/')){
  await new Promise(resolve=>setTimeout(resolve,600));
  if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'嗯，我在听。今天想和我聊些什么？',actionIds:[]})}}]}),{headers:{'Content-Type':'application/json'}});
 }
 return nativeFetch(input,init);
};
const catalog=await fetch('/room3d/catalog.json').then(r=>r.json());
const home=createStarterHome(catalog,'sage');
// Multiple preview tabs share the QA schedule: room identities must survive reloads.
home.rooms.forEach((room,index)=>{room.id=`qa-homely-room-${index}`;});
home.activeRoomId=home.rooms[0].id;
home.records=[{id:'homely-qa-u',at:Date.now()-3000,kind:'message',source:'user',actor:'user',text:'我回来啦。',roomId:home.activeRoomId,roomName:'客厅'}, {id:'homely-qa-a',at:Date.now()-2000,kind:'message',source:'model',actor:'character',text:'欢迎回来。\n今天过得怎么样？',replyTo:'homely-qa-u',roomId:home.activeRoomId,roomName:'客厅'}];
const initial={id:'qa-homely-preview',name:'Sully',avatar:'',systemPrompt:'自然地聊天。',scheduleFeatureEnabled:true,timeAwarenessEnabled:false,homeDefinition:{kind:'virtual',notes:''},chibiStudio:{home3D:{state:testCharacter.state,hair:{bodyShape:'blank',layers:{},extras:[]}}},home3D:home} as CharacterProfile;
await DB.saveCharacter(initial);
const date=getLocalDateKey(new Date());
await DB.saveDailySchedule({id:initial.id+'_'+date,charId:initial.id,date,generatedAt:Date.now(),slots:[{startTime:'00:00',activity:'在家自由活动',homePosition:{kind:'home',roomId:home.activeRoomId}}]} as any);
const mockApi={baseUrl:'/__homely_mock__',apiKey:'fixture',model:'local-test'};
async function previewMusic(music:ReturnType<typeof useMusic>){
 const rate=8000,seconds=90,data=new ArrayBuffer(44+rate*seconds*2),view=new DataView(data);
 const text=(at:number,value:string)=>[...value].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
 text(0,'RIFF');view.setUint32(4,data.byteLength-8,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,data.byteLength-44,true);
 for(let i=0;i<rate*seconds;i++){const t=i/rate,beat=t%.6,f=[261.63,329.63,392,329.63][Math.floor(t/.6)%4];view.setInt16(44+i*2,Math.sin(t*f*Math.PI*2)*Math.exp(-beat*7)*900,true);}
 await DB.saveAssetRaw('qa-homely-music',new Blob([data],{type:'audio/wav'}));
 const song={id:-90401,name:'窗边的午后',artists:'居家预览 · 合成试听',album:'本地测试',albumPic:'',duration:seconds*1000,fee:0,local:true,localAssetKey:'qa-homely-music'};
 await music.playSong(song,{replaceQueue:[song,{...song,id:-90402,name:'慢慢待着'}]});
}
function Preview(){
 const os=useOS(),[character,setCharacter]=useState(initial),[activeApp,setActiveApp]=useState(AppID.Launcher),[editor,setEditor]=useState<HomeEditor>(),[report,setReport]=useState('');
 const [previewTheme,setPreviewTheme]=useState<OSTheme>(()=>({...os.theme,skin:'homely',contentColor:'#695344',homelyPalette:'apricot',homelyLockedCharacterId:undefined}));
 const [entryKey,setEntryKey]=useState(0);
 const showSecret=async()=>{await DB.saveAsset('home_secrets_v1_'+initial.id,JSON.stringify({requests:[],secrets:[{id:'qa-paper',anchor:'qa-paper',anchorId:'qa-paper',kind:'character',petIds:[],seen:false,text:'你回家前，Sully 把沙发上的靠垫重新摆好了。ta 说是随手整理，实际上已经悄悄挑过一个最舒服的位置。'}]}));setEntryKey(n=>n+1);};
 const qa=new URLSearchParams(location.search).has('qa');
 const music=useMusic(),[presence,setPresence]=useState('');
 const freezeTimer=useRef<ReturnType<typeof setInterval>>();
 useEffect(()=>()=>clearInterval(freezeTimer.current),[]);
 const freezePeek=()=>{
  if(!editor?.startHomelyAttention?.()){setReport('当前正在忙，稍后再试');return;}
  clearInterval(freezeTimer.current);let checks=0;
  freezeTimer.current=setInterval(()=>{const s=editor.inspect?.() as {homelyAttention?:{close:number}};if((s?.homelyAttention?.close??0)>.97){editor.advanceTime?.(0);clearInterval(freezeTimer.current);setReport('已定格跨界效果；刷新恢复动画');}else if(++checks>150)clearInterval(freezeTimer.current);},100);
 };
 // Deterministic visual fixture: start once the real character is ready,
 // before its first autonomous activity, then freeze only the inspection clock.
 useEffect(()=>{
  if(!editor||new URLSearchParams(location.search).get('qa')!=='peek')return;
  let started=false,checks=0;
  const timer=setInterval(()=>{if(++checks>240){clearInterval(timer);return;}if(!started){started=editor.startHomelyAttention?.()??false;return;}const s=editor.inspect?.() as {homelyAttention?:{close:number}};if((s?.homelyAttention?.close??0)>.97){editor.advanceTime?.(0);setReport('已定格跨界效果；刷新恢复动画');clearInterval(timer);}},250);
  return()=>clearInterval(timer);
 },[editor]);
 useEffect(()=>{if(!qa||!editor)return;const timer=setInterval(()=>{const s=editor.inspect?.() as {homelyAttention?:unknown;musicSway?:number;zoom?:number}|undefined;setPresence(JSON.stringify({attention:s?.homelyAttention,sway:s?.musicSway,zoom:s?.zoom}));},500);return()=>clearInterval(timer);},[qa,editor]);
 const inspect=()=>{const s=editor?.inspect();setReport(JSON.stringify({scene:editor?.getHomeScene(),companion:editor?.getCompanionSnapshot?.(),autonomy:editor?.getState().autonomy,gestures:s?.cameraGestures,residents:s?.social,position:s?.chibiPosition,posture:s?.chibiPosture,responseMotion:s?.responseMotion,touch:s?.lastHomelyTouch}));};
 const updateCharacter=(id:string,updates:any)=>{if(id!==initial.id)return;setCharacter(previous=>{const next={...previous,...(typeof updates==='function'?updates(previous):updates)};void DB.saveCharacter(next);return next;});};
 return <OSPreviewProvider value={{...os,characters:[character],activeCharacterId:character.id,setActiveCharacterId:()=>{},updateCharacter,activeApp,openApp:setActiveApp,closeApp:()=>setActiveApp(AppID.Launcher),isLocked:false,isDataLoaded:true,apiConfig:mockApi,customIcons:{},theme:previewTheme,updateTheme:async updates=>{setPreviewTheme(previous=>({...previous,...updates}));},userProfile:{...os.userProfile,name:'你'},groups:[]}}>
  {activeApp===AppID.Launcher?<HomelyHome key={entryKey} onEditor={setEditor}/>:<PhoneShell/>}
  {qa&&editor&&<details style={{position:'absolute',zIndex:80,top:0,left:0,maxWidth:'100%',background:'white',fontSize:10}}><summary>测试工具</summary><button onClick={inspect}>检查现场</button><button onClick={()=>void showSecret()}>测试秘密纸条</button><button onClick={()=>editor.setResidentRoom(null)}>测试外出</button><button onClick={()=>editor.setResidentRoom(home.activeRoomId)}>测试回家</button><button onClick={()=>{editor.setAutonomy(editor.getState().autonomy===false);inspect();}}>切换自主活动</button><button onClick={()=>{editor.performCompanionAction?.('sit',.3);}}>测试自主入座</button><button onClick={()=>void previewMusic(music)}>播放测试音乐</button><button onClick={()=>setReport(editor.startHomelyAttention?.()?'开始靠近':'当前正在忙，稍后再试')}>测试探头</button><button onClick={freezePeek}>定格探头（截图）</button><output style={{display:'block'}}>{presence}</output><output style={{display:'block',maxHeight:220,overflow:'auto',overflowWrap:'anywhere'}}>{report}</output></details>}
 </OSPreviewProvider>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<OSProvider><MusicProvider><Preview/></MusicProvider></OSProvider>);
import.meta.hot?.dispose(()=>{root.unmount();window.fetch=nativeFetch;});
