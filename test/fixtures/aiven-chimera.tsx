import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createGardenRenderer, type GardenView } from '../../apps/vrWorld/dinosaur/renderer';
import { DinoIcon } from '../../apps/vrWorld/dinosaur/DinoIcon';
import { createFishingMarketState } from '../../utils/vrWorld/fishingMarket';
import { createGardenMaps, defaultDinoPaint } from '../../utils/vrWorld/dinosaurCatalog';
import { syncGardenToys } from '../../utils/vrWorld/dinosaurGarden';
import type { DinoPaint } from '../../utils/vrWorld/dinosaurTypes';

// A memory-only fixture: this page never seeds, reads or writes the user's save.
const speciesId='aiven-chimera',catchId='qa-aiven-chimera';
const now=Date.UTC(2026,8,11);
const base={...createFishingMarketState(20260911),inventory:[{id:catchId,speciesId,ownerId:'user',ownerName:'试玩玩家',caughtAt:now,weather:'clear' as const,weatherLabel:'艾文的赠礼',weatherSource:'simulated' as const,sizeCm:12,quality:1 as const,origin:{kind:'gift' as const,actorId:'sar-evan',actorName:'艾文',at:now}}],dinosaurGarden:{version:2 as const,gridVersion:1 as const,activeMapId:'grassland',maps:createGardenMaps(),toys:{},events:[],visitsEnabled:false,revision:0}};
const state=syncGardenToys(base);
state.dinosaurGarden!.toys[catchId].pose={x:1.6,z:1.45,rotation:0};
state.dinosaurGarden!.toys[catchId].mapId='grassland';

function Preview(){
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createGardenRenderer>>();
  const [view,setView]=useState<GardenView>('portrait'),[paint,setPaint]=useState<DinoPaint>(defaultDinoPaint(speciesId)),[error,setError]=useState(''),[ready,setReady]=useState(false);
  useEffect(()=>{
    engine.current=createGardenRenderer(host.current!,{play:()=>{},selectProp:()=>{},select:()=>{},place:()=>{},ready:()=>setReady(true),error:setError});
    return ()=>engine.current?.dispose();
  },[]);
  useEffect(()=>{void engine.current?.sync(state,catchId,view,paint).catch(e=>setError(String(e)));},[view,paint]);
  useEffect(()=>{
    const w=window as typeof window&{render_game_to_text?:()=>string;advanceTime?:(ms:number)=>void};
    w.render_game_to_text=()=>JSON.stringify({mode:'aiven-chimera-model',speciesId,ready,error,paint,coordinates:'garden x horizontal, y upward, z depth; world units',...engine.current?.metrics()});
    w.advanceTime=ms=>engine.current?.advance(ms);
    return ()=>{delete w.render_game_to_text;delete w.advanceTime;};
  },[ready,error,paint]);
  return <><header><span className="icon"><DinoIcon species={speciesId} color={paint.body}/></span><div><h1>？？？</h1><p>艾文的特殊恐龙 ·「不知道是什么。所以不用纠正。」</p></div></header><div className="model" ref={host}/><nav><button onClick={()=>setView(v=>v==='portrait'?'garden':'portrait')}>{view==='portrait'?'放进箱庭':'查看模型'}</button><button onClick={()=>setPaint({body:'#e0bb80',accent:'#b88cad'})}>试试换色</button><button onClick={()=>setPaint(defaultDinoPaint(speciesId))}>原始配色</button><button onClick={()=>engine.current?.greet()}>打招呼</button><button onClick={()=>engine.current?.reset()}>重置视角</button></nav>{error&&<p role="alert">{error}</p>}</>;
}
document.head.insertAdjacentHTML('beforeend','<style>*{box-sizing:border-box}body{margin:0;background:#f2eee3;color:#54473f;font:14px system-ui}header{height:92px;display:flex;align-items:center;gap:18px;padding:18px 24px}h1{margin:0;font:24px Georgia}p{margin:7px 0 0;font-size:12px}.icon{width:66px;flex-shrink:0}.model{height:calc(100svh - 166px);min-height:330px;width:100%}nav{height:74px;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 12px;flex-wrap:wrap}button{border:1px solid #d8ccba;background:#fffbf3;color:#665446;border-radius:7px;font:inherit;padding:8px 10px}canvas{display:block;touch-action:none}@media(max-width:430px){header{padding:16px;gap:10px}.icon{width:48px}header p{font-size:10px}nav{gap:5px}button{font-size:11px;padding:9px 8px}}@media(max-width:360px){nav{height:96px}.model{height:calc(100svh - 188px)}}</style>');
createRoot(document.getElementById('root')!).render(<Preview/>);
