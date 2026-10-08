import {useEffect,useRef} from 'react';
import type {APIConfig,CharacterProfile} from '../../types';
import {emotionMaterial,homeEmotionEnabled,type TimedHomeEmotion} from '../../utils/homeEmotion';
import {loadHomeEmotion} from '../../utils/homeEmotionLoader';
export function useHomeEmotion(char:CharacterProfile|undefined,api:APIConfig|undefined,enabled:boolean){
 const state=useRef<TimedHomeEmotion>(),latest=useRef({char,api});latest.current={char,api};
 const material=char?JSON.stringify([emotionMaterial(char),char.activeBuffs?.map(b=>[b.homeBehavior,b.homeBehaviorAt])]):'';
 const on=!!char&&homeEmotionEnabled(char);
 useEffect(()=>{
  state.current=undefined;if(!char||!enabled||!on)return;
  let controller:AbortController|undefined,disposed=false;
  const refresh=async(value:CharacterProfile)=>{
   controller?.abort();state.current=undefined;const current=new AbortController();controller=current;
   const timer=setTimeout(()=>current.abort(),20000);
   try{const next=await loadHomeEmotion(value,latest.current.api,current.signal,true);if(!disposed&&!current.signal.aborted)state.current=next;}catch{/* Ordinary behavior on failure; no polling model requests. */}finally{clearTimeout(timer);}
  };
  const changed=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.charId===char.id)void refresh({...latest.current.char!,activeBuffs:d.buffs,buffInjection:d.buffInjection});};
  void refresh(latest.current.char!);window.addEventListener('emotion-updated',changed);
  return()=>{disposed=true;controller?.abort();state.current=undefined;window.removeEventListener('emotion-updated',changed);};
 },[char?.id,material,on,enabled,api?.baseUrl,api?.model]);
 return state;
}
