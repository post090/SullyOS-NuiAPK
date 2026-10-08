import {homeBubblePosition} from './homelyView';
import React,{useEffect,useRef,useState} from 'react';
import type {HomeEditor} from './editor.js';
import {speechPages,speechPageDuration} from '../../utils/homeCompanion';
import './homeSpeechBubble.css';
type View={text:string;x:number;y:number;reaction:boolean;key:string;retired?:number;id:string};
export function HomeSpeechBubble({editor}:{editor:HomeEditor}){
 const [views,setViews]=useState<View[]>([]);const history=useRef<View[]>([]);
 useEffect(()=>{
  let lastKey='';history.current=[];
  const tick=()=>{
   const now=Date.now(),bubble=editor.getHomeBubble?.();let next:View|undefined;
   if(bubble&&!document.hidden){
    let age=now-bubble.at;const reaction=bubble.kind==='reaction',pages=speechPages(bubble.text);let index=0;
    while(index<pages.length&&age>=(reaction?2600:speechPageDuration(pages[index]))){age-=reaction?2600:speechPageDuration(pages[index]);index++;}
    const anchor=index<pages.length&&age>=0?editor.getResidentAnchor?.(bubble.id):null;
    if(anchor&&anchor.x>=0&&anchor.x<=anchor.width&&anchor.y>=0&&anchor.y<=anchor.height)next={text:pages[index],...homeBubblePosition(anchor,'speech'),reaction,key:bubble.id+':'+bubble.at+':'+index,id:bubble.id};
   }
   if(document.hidden||!bubble){history.current=[];lastKey='';}
   else if(next){
    if(next.key!==lastKey){history.current=history.current.map(v=>({...v,retired:v.retired??now}));history.current.push(next);lastKey=next.key;}
    else history.current=history.current.map(v=>v.key===next!.key?next!:v);
   }else history.current=history.current.filter(v=>v.retired);
   history.current=history.current.filter(v=>!v.retired||now-v.retired<1800).slice(-2);
   const visible=history.current.filter(v=>!!editor.getResidentAnchor?.(v.id));
   setViews(previous=>previous.length===visible.length&&previous.every((v,i)=>Object.keys(v).every(k=>v[k as keyof View]===visible[i][k as keyof View]))?previous:visible.map(v=>({...v})));
  };
  tick();const timer=setInterval(tick,100);return()=>clearInterval(timer);
 },[editor]);
 return <>{views.map(view=><div className={'home-speech-bubble'+(view.reaction?' home-speech-reaction':'')+(view.retired?' home-speech-retiring':'')} style={{left:view.x,top:view.y}} key={view.key} role={view.retired?undefined:'status'} aria-hidden={view.retired?true:undefined}>{view.text}</div>)}</>;
}
