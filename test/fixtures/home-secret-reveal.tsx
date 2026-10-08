import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import HomeSecretsReveal from '../../apps/room3d/HomeSecretsReveal';
import ChatHeaderShell from '../../components/chat/ChatHeaderShell';
import {DB} from '../../utils/db';
import {createLocalId} from '../../utils/localId.js';
import {readHomeSecrets} from '../../utils/homeSecrets';
import '../../components/chat/chatPreview.generated.css';
import 'animal-island-ui/style';
import '../../apps/room3d/islandTheme.css';
const charId='qa-secret-popup-'+createLocalId(),assetKey='home_secrets_v1_'+charId;
const avatar='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#ddd9e9"/><text x="32" y="43" text-anchor="middle" fill="#655779" font-size="28">澄</text></svg>');
const first='你夸阿澄衣服好看时，ta 说是随手穿的。其实发出那句之前，ta 刚偷偷把衣领抚平了一遍。';
function Page(){
 const [active,setActive]=useState(false),[remark,setRemark]=useState(true),[center,setCenter]=useState(false),[readCount,setReadCount]=useState(0);
 const enter=async(long=false)=>{
  await DB.saveAsset(assetKey,JSON.stringify({requests:[],secrets:[first,'你出门以后，阿澄给窗边的绿植浇了水，又把你的拖鞋摆回床边。ta 没有提这件事，只说屋里今天很安静。'].map((text,i)=>({id:String(i+1),anchor:'demo-'+i,anchorId:'demo-'+i,kind:'character',petIds:[],seen:false,text:long&&i===0?Array(16).fill(text).join('\n\n'):text}))}));
  setReadCount(0);setActive(true);
 };
 useEffect(()=>{if(!active)return;const id=setInterval(()=>void readHomeSecrets(charId).then(rows=>setReadCount(rows.filter(s=>s.seen).length)),300);return()=>clearInterval(id);},[active]);
 return <div className="home-island demo-shell">
  <ChatHeaderShell activeCharacter={{id:charId,name:'阿澄',description:'我的小栗',chatShowRemark:remark,avatar}} selectionMode={false} selectedCount={0} isTyping={false} isSummarizing={false} lastTokenUsage={null} onCancelSelection={()=>{}} onClose={()=>{}} onTriggerAI={()=>{}} onShowCharsPanel={()=>{}} headerAlign={center?'center':'left'}/>
  <div className="demo-content"><h2>小屋纸条 · 演示数据</h2><label><input type="checkbox" checked={remark} onChange={e=>setRemark(e.target.checked)}/>聊天显示备注</label><label><input type="checkbox" checked={center} onChange={e=>setCenter(e.target.checked)}/>居中顶栏</label>
   <button onClick={()=>void enter()} disabled={active}>进入小屋</button><button onClick={()=>void enter(true)} disabled={active}>长纸条演示</button><button onClick={()=>setActive(false)}>离开小屋</button>
   <button onClick={()=>{setActive(false);void DB.deleteAsset(assetKey).then(()=>setReadCount(0));}}>清理演示数据</button><output>已读 {readCount} 张；角色本名始终为阿澄</output>
  </div>
  <HomeSecretsReveal charId={charId} active={active}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<Page/>);
