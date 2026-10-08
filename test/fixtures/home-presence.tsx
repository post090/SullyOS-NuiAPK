import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Home3DView from '../../apps/room3d/Home3DView';
import {testCharacter} from './room3d-test-character';import {createHome} from '../../apps/room3d/model.js';
import {DB} from '../../utils/db';
const catalog=await fetch('/room3d/catalog.json').then(r=>r.json()),initial=createHome(catalog);initial.rooms[0].items=[];initial.rooms[0].name='晴天客厅';
const user={name:'小雨'} as any,base={id:'qa-home-presence-only',name:'Sully',timeAwarenessEnabled:false,contextRangePolicyVersion:1,contextRangeMode:'manual',contextLimit:50,activeBuffs:[{id:'warm',name:'warm',label:'心情很好',emoji:'❤️',intensity:1}],homeDefinition:{kind:'between-worlds',notes:''},chibiStudio:{home3D:{state:testCharacter.state,hair:{bodyShape:'blank'}}}} as any;
const requests:any[]=[];(window as any).__homePresenceRequests=requests;const original=fetch;
window.fetch=async(input,init)=>{const url=String(input);if(url.startsWith('/__presence-preview__/')){requests.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'刚才在窗边站了一会儿，忽然想和你分享今天的小事。你愿意陪我一起听听外面的风声吗？慢慢待在这里也很好。',actionId:null})}}]}),{headers:{'Content-Type':'application/json'}});}return original(input,init);};
function App(){const [home,setHome]=useState(initial);const char={...base,home3D:home};return <Home3DView value={home} user={user} character={char} residents={[{id:'user',label:'小雨',state:testCharacter.state}]} api={{baseUrl:'/__presence-preview__',model:'fixture'} as any} onChange={value=>{setHome(value);void DB.saveCharacter({...base,home3D:value});}} onBack={()=>{}} onEditor={editor=>{const w=window as any;w.__homeEditor=editor;w.advanceTime=(ms:number)=>editor.advanceTime(ms);w.render_game_to_text=()=>JSON.stringify(editor.inspect());}}/>;}
createRoot(document.getElementById('root')!).render(<App/>);
