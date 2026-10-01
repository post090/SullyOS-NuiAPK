import {useEffect,useState} from 'react';

/** Debounce only rendering; callers keep their current draft for save/apply actions. */
export function usePreviewDraft<T>(value:T,editing:boolean){
 const [settled,setSettled]=useState(value);
 useEffect(()=>{
  if(!editing){setSettled(value);return;}
  const timer=setTimeout(()=>setSettled(value),300);
  return()=>clearTimeout(timer);
 },[value,editing]);
 return editing?settled:value;
}
