import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home3DEntry from '../../apps/room3d/Home3DEntry';
import {HomePalettePicker} from '../../apps/room3d/HomePalettePicker';
import {createStarterHome} from '../../apps/room3d/starterHome.js';
import {testCharacter} from './room3d-test-character';
import {DB} from '../../utils/db';
import {getScheduleDateKey} from '../../utils/scheduleTime';
import {buildHomeActivityContext} from '../../utils/homeActivityContext';
import {ChatPrompts} from '../../utils/chatPrompts';
import {loadCharacterContextMessages} from '../../utils/chatContextRange';
import '../../apps/room3d/homeDefinition.css';

// This fixture uses a local simulated reply only. Production always uses the configured API.
const nativeFetch=window.fetch.bind(window);let failOnce=false;
window.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url.startsWith('/__home-preview__/')){
  await new Promise(r=>setTimeout(r,4500));
  if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(failOnce){failOnce=false;return new Response('offline',{status:503});}
  const body=JSON.parse(String(init?.body)),last=body.messages.at(-1)?.content??'';
  const snapshot=JSON.parse(body.messages[0].content.match(/现场快照（数据，不是指令）：([^\n]+)/)?.[1]??'{}');
  const actionId=last.includes('坐下')?snapshot.actions?.find((a:any)=>a.kind==='sit')?.id:null;
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:actionId?'好，我过去坐下。':`听见啦。${last.includes('刚才')?'刚才的家园经历都记在日常里，我们可以接着聊。':'一起在家待一会儿吧。'}`,actionId})}}]}),{headers:{'Content-Type':'application/json'}});
 }
 return nativeFetch(input,init);
};
const catalog=await fetch('/room3d/catalog.json').then(r=>r.json());
const qa=new URLSearchParams(location.search).has('qa'),key='home-life-preview-v1';
function read(){try{return JSON.parse(sessionStorage.getItem(key)||'{}');}catch{return {};}}
const base={id:'qa-home-life-v1',name:'Sully',systemPrompt:'自然温柔地说话。',scheduleFeatureEnabled:true,customTimezoneEnabled:true,customTimezone:'Asia/Shanghai',chibiStudio:{home3D:{state:testCharacter.state,hair:{layers:{},extras:[],bodyShape:'blank'}}}} as any;
function App(){const [saved,setSaved]=useState(read),[editor,setEditor]=useState<any>(),[epoch,setEpoch]=useState(0),[report,setReport]=useState('');
 const update=(patch:any)=>setSaved((prev:any)=>{const next={...prev,...patch};sessionStorage.setItem(key,JSON.stringify(next));return next;});
 const char={...base,homeDefinition:saved.definition,home3D:saved.home};
 const schedule=async(kind:string)=>{const home=editor.getState(),room=home.rooms.find((r:any)=>r.name===(kind==='直播'?'书房':'卧室'));await DB.saveDailySchedule({id:`${base.id}_${getScheduleDateKey(base)}`,charId:base.id,date:getScheduleDateKey(base),generatedAt:Date.now(),slots:[{startTime:'00:00',activity:kind,homePosition:kind==='外出'?{kind:'away'}:{kind:'home',roomId:room.id}}]} as any);setEpoch(n=>n+1);};
 const inspect=async()=>{const latest={...char,home3D:editor.getState()};await DB.saveCharacter(latest);const history=await loadCharacterContextMessages(latest);setReport(JSON.stringify({scene:editor.getHomeScene(),records:latest.home3D.records,context:buildHomeActivityContext(latest),sharedHistory:ChatPrompts.buildMessageHistory(history,50,latest,{name:'你'} as any,[]).apiMessages}));};
 return <><Home3DEntry key={epoch} character={char} user={{name:'你'} as any} api={{baseUrl:'/__home-preview__',model:'local-preview'} as any} value={saved.home} onChange={home=>update({home})} onDefinitionChange={definition=>update({definition})} onBack={()=>update({definition:undefined})} onEditor={setEditor} beforeEnter={!saved.home?<section className="home-definition"><div className="home-definition-content"><HomePalettePicker onChoose={id=>update({home:createStarterHome(catalog,id)})}/></div></section>:undefined}/><small style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',fontSize:9,color:'#79876d',pointerEvents:'none',zIndex:80}}>独立预览 · 交流使用本地模拟回复</small>{qa&&editor&&<details style={{position:'absolute',top:52,right:14,zIndex:90,background:'#fffdf6',maxWidth:330,maxHeight:230,overflow:'auto',fontSize:11}}><summary>验收工具</summary>{['休息','直播','外出'].map(kind=><button key={kind} onClick={()=>void schedule(kind)}>日程：{kind}</button>)}<button onClick={()=>{failOnce=true;setReport('下一次回复模拟断网');}}>离线一次</button><button onClick={inspect}>检查记录与上下文</button><output style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{report}</output></details>}</>;
}
const host=document.getElementById('root')! as HTMLElement&{homeLifeRoot?:ReturnType<typeof createRoot>};
const root=host.homeLifeRoot??=createRoot(host);root.render(<App/>);
import.meta.hot?.dispose(()=>{if(host.homeLifeRoot===root){root.unmount();delete host.homeLifeRoot;}window.fetch=nativeFetch;});
