import {publishHomeCompanionDebug,companionWaitReason,type HomeCompanionDebug} from '../../utils/homeCompanionDebug';
import {useHomeEmotion} from './useHomeEmotion';
import {emotionCompanionPolicy,emotionCooldown} from '../../utils/homeEmotion';
import {useEffect,useRef} from 'react';
import type {APIConfig,CharacterProfile,UserProfile} from '../../types';
import type {HomeEditor} from './editor.js';
import {chooseCompanionAction,quietCompanion,type CompanionMemory} from '../../utils/homeCompanion';
import {loadCompanionPolicy} from '../../utils/homeCompanionPolicy';
import {ROOM_PLATES_UPDATED_EVENT} from '../../utils/memoryPalace/db';
export function useHomeCompanion(editor:HomeEditor|undefined,char:CharacterProfile|undefined,user:UserProfile|undefined,api:APIConfig|undefined,ready:boolean,suspended:boolean){
 const emotion=useHomeEmotion(char,api,ready&&!suspended);
 const latest=useRef({char,user,api});latest.current={char,user,api};
 useEffect(()=>{
  if(!editor||!char||!ready||suspended)return;
  let policy=quietCompanion,controller:AbortController|undefined,disposed=false,debounce:ReturnType<typeof setTimeout>|undefined;
  const memory:CompanionMemory={nextAt:Date.now()+15000};
  const debug:HomeCompanionDebug={name:char.name,active:true,updatedAt:Date.now(),nextAt:memory.nextAt,status:'入场后等待首次判断',checks:0,attempts:0,started:0,failed:0,reasons:{},recent:[]};
  const report=(status:string)=>{debug.status=status;debug.updatedAt=Date.now();debug.nextAt=memory.nextAt;debug.reasons[status]=(debug.reasons[status]||0)+1;publishHomeCompanionDebug(debug);};
  publishHomeCompanionDebug(debug);
  const refresh=async()=>{
   controller?.abort();const request=new AbortController();controller=request;
   policy=quietCompanion;const timeout=setTimeout(()=>request.abort(),20000);
   try{const value=latest.current;const result=await loadCompanionPolicy(value.char!,value.user,value.api,request.signal,true);if(!disposed&&!request.signal.aborted)policy=result;}
   catch{/* Unavailable interpretation stays conservative, without a retry loop. */}
   finally{clearTimeout(timeout);}
  };
  const changed=(event:Event)=>{if((event as CustomEvent).detail?.charId===char.id){policy=quietCompanion;controller?.abort();clearTimeout(debounce);debounce=setTimeout(()=>void refresh(),600);}};
  void refresh();window.addEventListener(ROOM_PLATES_UPDATED_EVENT,changed);
  const tick=()=>{
   debug.checks++;if(document.hidden){report('页面在后台，暂停决策');return;}if(editor.getState?.().autonomy===false){report('自主活动已关闭');return;}
   const snapshot=editor.getCompanionSnapshot?.();if(!snapshot){report('编辑器尚未提供状态');return;}debug.snapshot=snapshot;
   const now=Date.now(),effective=emotionCompanionPolicy(policy,emotion.current,now),action=chooseCompanionAction(snapshot,effective,memory,now,Math.random());if(!action){report(companionWaitReason(snapshot,memory.nextAt,now));return;}
   const started=editor.performCompanionAction?.(action,effective.warmth);debug.attempts++;if(started)debug.started++;else debug.failed++;
   const after=editor.getCompanionSnapshot?.();debug.snapshot=after||snapshot;debug.recent.unshift({at:now,action,result:(!started&&after?.lastResult==='已启动（不代表已完成）')?'执行条件未满足':after?.lastResult||(started?'已启动（不代表已完成）':'执行条件未满足')});debug.recent=debug.recent.slice(0,8);
   const pace={quiet:1.6,normal:1,lively:.6}[editor.getState?.().activityFrequency||'normal']||1;
   memory.nextAt=now+(started?(action==='stand'?3000:action==='react'?12000:emotionCooldown(emotion.current,now)*pace):3000);if(started)memory.lastAction=action;
   if(started&&action==='react'){memory.reactionId=snapshot.reactionId;memory.reactionAt=now;}
   report(started?'已发起动作':'动作未启动');
  };
  const timer=setInterval(tick,3000);
  return()=>{debug.active=false;report('家园已退出、挂起或重新加载');disposed=true;controller?.abort();clearTimeout(debounce);clearInterval(timer);window.removeEventListener(ROOM_PLATES_UPDATED_EVENT,changed);editor.cancelCompanionAction?.();};
 },[editor,char?.id,char?.memoryPalaceEnabled,user?.name,api?.baseUrl,api?.model,ready,suspended]);
}
