import {createLocalId} from '../../utils/localId.js';
import {homeBubblePosition} from './homelyView';
import React,{useEffect,useRef,useState} from 'react';
import type {HomeEditor} from './editor.js';
import type {CharacterProfile} from '../../types';
import {homeInitiative} from '../../utils/homeInitiative';
import {isScheduleFeatureOn} from '../../utils/scheduleFeature';
import {homeRecords} from '../../utils/homeRecords';
export interface HomeInitiativeRequest {id:string;roomId:string;reason:string;automatic?:boolean}
export function HomePresenceBubbles({editor,character,enabled,canInvite=false,onInitiative}:{editor:HomeEditor;character?:CharacterProfile;enabled:boolean;canInvite?:boolean;onInitiative:(request:HomeInitiativeRequest)=>void}){
 const latest=useRef({character,enabled,canInvite,onInitiative});latest.current={character,enabled,canInvite,onInitiative};
 const pending=useRef<{key:string;reason:string}>();
 const clock=useRef({entered:Date.now(),offered:0,consumed:''});
 const [view,setView]=useState<{x:number;y:number;emoji?:string;code?:string;petName?:string;petPortrait?:string;offer?:{key:string;reason:string};roomId:string}>();
 useEffect(()=>{pending.current=undefined;clock.current={entered:Date.now(),offered:0,consumed:''};const tick=()=>{
  const {character:char,enabled}=latest.current;if(!char||(!enabled&&!pending.current)||document.hidden){setView(undefined);return;}
  const home=editor.getState(),scene=editor.getHomeScene(),snapshot=editor.getCompanionSnapshot?.(),now=Date.now(),anchor=editor.getResidentAnchor?.(char.id);
  if(!scene.present||!anchor||anchor.x<0||anchor.x>anchor.width||anchor.y<0||anchor.y>anchor.height){setView(undefined);return;}
  if(!pending.current&&(scene.busy||!(home.directSpeech?(snapshot?.speechReady??snapshot?.ready):snapshot?.ready))){setView(undefined);return;}
  const candidate=latest.current.canInvite?homeInitiative(homeRecords(home),scene.roomId,now,clock.current.entered,clock.current.offered):null;
  if(!pending.current&&candidate&&candidate.key!==clock.current.consumed)pending.current=candidate;
  const offer=pending.current;
  if(offer&&home.directSpeech===true&&enabled&&latest.current.canInvite&&!scene.busy&&(snapshot?.speechReady??snapshot?.ready)){
   clock.current.offered=now;clock.current.consumed=offer.key;pending.current=undefined;setView(undefined);
   latest.current.onInitiative({id:createLocalId(),roomId:scene.roomId,reason:offer.reason,automatic:true});return;
  }
  const phase=(now-clock.current.entered)%16000;
  const speech=editor.getHomeBubble?.();if(!offer&&speech&&now-speech.at<12000){setView(undefined);return;}
  if(!offer&&phase<10000){setView(undefined);return;}
  const buffs=isScheduleFeatureOn(char)&&char.emotionConfig?.enabled?(char.activeBuffs||[]).filter(b=>b.emoji):[],cycle=Math.floor((now-clock.current.entered)/16000),buff=buffs[cycle%Math.max(1,buffs.length)];
  const pets=home.petLife?.pets||[],pet=pets.length&&cycle%3===1?pets[Math.floor(cycle/3)%pets.length]:undefined;
  const everyday=['🤔','🎵','☕','✨','🌷','📚','🍰','🌤️','💭','🎮','🍀','🫧'];const emoji=buff?.emoji?.slice(0,16)||everyday[cycle%everyday.length];
  setView({...homeBubblePosition(anchor,'thought'),roomId:scene.roomId,offer,petName:pet?.name,petPortrait:pet?editor.getPetPortrait?.(pet.id):undefined,emoji,code:emoji?({'❤️':'2764','❤':'2764','💤':'1F4A4','🎵':'1F3B5','🤔':'1F914'}[emoji]):undefined});
 };tick();const timer=setInterval(tick,500);return()=>clearInterval(timer);},[editor,character?.id]);
 if(!view)return null;
 const style={left:view.x,top:view.y};
 const dismiss=()=>{if(!pending.current)return;clock.current.offered=Date.now();clock.current.consumed=pending.current.key;pending.current=undefined;setView(undefined);};
 if(view.offer)return <div className="home-presence-bubble home-presence-invite" style={style}>
  <button className="home-presence-listen" aria-label={(character?.name||'角色')+'有话想说，点击听听'} title="想和你说点什么" onClick={()=>{const scene=editor.getHomeScene(),offer=pending.current;if(!offer||!scene.present||scene.roomId!==view.roomId)return;dismiss();onInitiative({id:createLocalId(),roomId:scene.roomId,reason:offer.reason});}}>···</button>
  <button className="home-presence-dismiss" aria-label="关闭这次说话邀请" title="暂时不听" onClick={e=>{e.stopPropagation();dismiss();}}>×</button>
 </div>;
 return <div className="home-presence-bubble" style={style} aria-label={view.petName?'正在想着宠物'+view.petName:view.emoji?'情绪想象':'正在想事情'} title={view.petName?'想到了'+view.petName:undefined}>{view.petName?(view.petPortrait?<img src={view.petPortrait} alt={view.petName}/>:<span className="home-presence-emoji">🐾</span>):view.code?<img src={`${import.meta.env.BASE_URL}room3d/thoughts/${view.code}.svg`} alt=""/>:<span className="home-presence-emoji">{view.emoji}</span>}</div>;
}
