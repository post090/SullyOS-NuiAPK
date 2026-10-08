import React, {useEffect, useState} from 'react';
import {BookOpen, ChatCircle, HandWaving, TShirt} from '@phosphor-icons/react';
import type {HomeEditor} from './editor';
import type {ScheduleSlot} from '../../types';

export default function HomelyHud({editor,name,schedule,panel,onPanel,onFigures,ready,music}:{editor:HomeEditor;name:string;schedule:Pick<ScheduleSlot,'startTime'|'activity'>|null;panel:string|null;onPanel:(panel:string|null)=>void;onFigures?:()=>void;ready:boolean;music?:React.ReactNode}) {
  const [scene,setScene]=useState(()=>editor.getHomeScene());
  const [notice,setNotice]=useState('');
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)setScene(editor.getHomeScene());},1000);return()=>clearInterval(timer);},[editor]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);},[notice]);
  return <>
    <header className="homely-heading"><span>居 家 <i/> {scene.roomName}</span><h1>{name}</h1><p role="status">{!ready?'正在准备形象…':scene.present?scene.activity:'现在不在家，晚点再见'}</p><div className="homely-schedule" aria-label="当前日程"><small>当前日程{schedule&&<> · <time>{schedule.startTime}</time> 起</>}</small><p>{schedule?.activity||'此刻没有日程安排'}</p></div>{music}</header>
    <nav className="homely-moments" aria-label="家中互动">
      <button aria-label="向角色打招呼" disabled={!ready||!scene.present||scene.busy} onClick={()=>{setNotice(editor.playHomeResponse?.('local',undefined,.6,'vrma-8bd33d84e90c0243')?'向 TA 打了个招呼':'TA 正忙着，等一会儿吧');}}><HandWaving size={22}/><span>招呼</span></button>
      {onFigures&&<button onClick={onFigures}><TShirt size={22}/><span>形象</span></button>}
      <button onClick={()=>onPanel(panel==='journal'?null:'journal')}><BookOpen size={22}/><span>日常</span></button>
    </nav>
    {panel!=='chat'&&<button className="homely-chat-open" aria-label="展开家园聊天" onClick={()=>onPanel('chat')}><ChatCircle size={22}/><span>聊聊</span></button>}
    {notice&&<p className="homely-feedback" role="status">{notice}</p>}
  </>;
}
