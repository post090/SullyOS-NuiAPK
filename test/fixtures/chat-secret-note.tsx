/** Real persistence, parent deletion and production message rendering, with synthetic data only. */
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import ChatMessage from '../../components/chat/MessageItem';
import ChatHistoryCleanupModal from '../../components/chat/ChatHistoryCleanupModal';
import {isVisibleChatMessage} from '../../utils/chatMessageVisibility';
import {PRESET_THEMES} from '../../components/chat/ChatConstants';
import '../../components/chat/chatPreview.generated.css';
import {DB} from '../../utils/db';
import {prepareHomeSecretTask,landHomeSecrets} from '../../utils/homeSecrets';
import {createLocalId} from '../../utils/localId.js';
import type {Message} from '../../types';
const char:any={id:'qa-secret-note-'+createLocalId(),name:'阿澄',home3D:{version:1,activeRoomId:'r',rooms:[{id:'r',name:'卧室',items:[]}]}};
const avatar='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#ddd9e9"/><text x="32" y="43" text-anchor="middle" fill="#655779" font-size="28">澄</text></svg>');
let parentIds:number[]=[];
function Page(){
 const [rows,setRows]=useState<Message[]>([]),[ready,setReady]=useState(false),[managing,setManaging]=useState(false);
 const load=async()=>setRows(await DB.getRecentMessagesByCharId(char.id,10));
 useEffect(()=>{void(async()=>{
  await DB.saveCharacter(char);
  parentIds=[await DB.saveMessage({charId:char.id,role:'assistant',type:'text',content:'这件衣服啊？随手穿的。'}),await DB.saveMessage({charId:char.id,role:'assistant',type:'text',content:'不过，谢谢你。'})];
  const task=(await prepareHomeSecretTask(char,[{role:'user',content:'你今天穿的衣服很好看'},{role:'assistant',content:'嗯，谢谢。'}],()=>0))!;
  await landHomeSecrets(char.id,{homeSecretRequestId:task.id,homeSecrets:[{kind:'character',anchorId:task.id,petIds:[],text:'你夸阿澄衣服好看时，ta 说是随手穿的。其实发出那句之前，ta 刚偷偷把衣领抚平了一遍。'}]},task.id,undefined,{source:'chat',messageIds:parentIds});
  await load();setReady(true);
 })();},[]);
 return <main><header>阿澄 · 聊天</header>{rows.filter(m=>isVisibleChatMessage(m)).map(msg=><ChatMessage key={msg.id} msg={msg} isFirstInGroup isLastInGroup activeTheme={PRESET_THEMES.default} charAvatar={avatar} charName={char.name} userAvatar={avatar} onLongPress={()=>{}} onReply={()=>{}} selectionMode={false} isSelected={false} onToggleSelect={()=>{}}/>)}
  <button disabled={!ready} onClick={()=>setManaging(true)}>操作历史记录</button>
  <button disabled={!ready} onClick={()=>void DB.deleteMessage(parentIds[0]).then(load)}>删除本轮第一条回复</button>
  <button onClick={()=>void DB.clearMessages(char.id).then(()=>DB.deleteCharacter(char.id)).then(()=>DB.deleteAsset('home_secrets_v1_'+char.id)).then(load)}>清理演示数据</button>
  <output>{rows.length} 条历史 · {rows.filter(m=>m.type==='secret_note').length} 张秘密小纸条</output>
  {managing && <ChatHistoryCleanupModal character={char} onClose={()=>setManaging(false)} onDeleted={load}/>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Page/>);
