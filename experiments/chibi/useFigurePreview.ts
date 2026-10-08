import {useEffect,useState} from 'react';
import type {HairSettings} from '../../apps/room3d/chibi/types';

function sameGeometry(a:HairSettings,b:HairSettings){
 const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 keys.delete('face');
 return [...keys].every(key=>a[key as keyof HairSettings]===b[key as keyof HairSettings]);
}

/** Keep native slider feedback independent of expensive mesh/clothing rebuilds. */
export function useFigurePreview(value:HairSettings,interacting:boolean){
 const [preview,setPreview]=useState(value);
 const deferred=interacting&&!sameGeometry(value,preview);
 useEffect(()=>{
  if(value===preview||deferred)return;
  const timer=setTimeout(()=>setPreview(value),interacting?80:60);
  return()=>clearTimeout(timer);
 },[value,preview,interacting,deferred]);
 return {preview,deferred};
}
