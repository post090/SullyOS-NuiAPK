import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OSProvider} from '../../context/OSContext';
import {MusicProvider} from '../../context/MusicContext';
import Home3DView from '../../apps/room3d/Home3DView';
import {createStarterHome} from '../../apps/room3d/starterHome.js';
import {testCharacter} from './room3d-test-character';
import {DB} from '../../utils/db';

// Only use the isolated screenshot origin. Never seed the user's development database.
if(location.port!=='5190')throw Error('请在独立截图端口 5190 打开');
const catalog=await fetch('/room3d/catalog.json').then(r=>r.json());
const home=createStarterHome(catalog,'sage'),roomId=home.activeRoomId,now=Date.now();
home.records=[
 {id:'release-hi',at:now-130000,kind:'message',source:'user',actor:'user',text:'今天有点累，想在家陪你待一会儿。',roomId,roomName:'客厅'},
 {id:'release-answer',at:now-125000,kind:'message',source:'model',actor:'character',text:'那就慢慢待着吧。你刚才说的事，我还想听你多讲一点。',replyTo:'release-hi',roomId,roomName:'客厅'},
 ...['在窗边看了看风景。','整理了一下衣服。','拿起手机看了看。'].map((text,i)=>({id:'release-action-'+i,at:now-100000+i*20000,kind:'action',source:'local',actor:'character',text:'小栗'+text,roomId,roomName:'客厅'})),
];
const avatar='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#e7dac5"/><text x="40" y="51" text-anchor="middle" font-size="30" fill="#795b42">栗</text></svg>');
const character={id:'qa-release-home',name:'小栗',avatar,systemPrompt:'温柔自然地说话。',timeAwarenessEnabled:false,homeDefinition:{kind:'between-worlds',notes:''},home3D:home,chibiStudio:{home3D:{state:testCharacter.state,hair:{bodyShape:'blank'}}}} as any;
await DB.saveCharacter(character);
if(!sessionStorage.getItem('qa-release-seeded')){
 await DB.saveMessage({charId:character.id,role:'user',type:'text',content:'明明就在旁边，还是想给你发消息。'});
 await DB.saveMessage({charId:character.id,role:'assistant',type:'text',content:'收到啦。那这条消息，就当作我们之间的小纸条。'});
 sessionStorage.setItem('qa-release-seeded','1');
}
const api={baseUrl:'/__release_demo__',apiKey:'fixture',model:'local-demo'};
const original=window.fetch.bind(window);
window.fetch=async(input,init)=>String(input).startsWith('/__release_demo__')?new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'刚才看了会儿窗外，突然很想和你说说话。',actionIds:[]})}}]}),{headers:{'Content-Type':'application/json'}}):original(input,init);
function Scene(){const [value,setValue]=useState(home);return <Home3DView value={value} onChange={setValue} character={character} user={{name:'你'} as any} api={api as any} residents={[{id:'user',label:'你',state:testCharacter.state,hair:{bodyShape:'blank'}}]} onBack={()=>{}}/>;}
const root=createRoot(document.getElementById('root')!);root.render(<OSProvider><MusicProvider><Scene/></MusicProvider></OSProvider>);
import.meta.hot?.dispose(()=>{root.unmount();window.fetch=original;});
