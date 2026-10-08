import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Puppet} from '../../experiments/chibi/Puppet';
import {CreatorRollBridge} from '../../apps/room3d/chibi/CreatorRollBridge';
import {decodeParts} from '../../apps/room3d/chibi/visitor';
import type {Parts,HairSettings} from '../../apps/room3d/chibi/types';
function Check(){
 const [parts,setParts]=useState<Parts>(),[request,setRequest]=useState(0),[status,setStatus]=useState('Loading…'),[hair,setHair]=useState<HairSettings>({layers:{},extras:[]});
 useEffect(()=>{if(!parts)return;let disposed=false;const timers:ReturnType<typeof setTimeout>[]=[];
  const later=(fn:()=>void,ms:number)=>timers.push(setTimeout(()=>{if(!disposed)fn();},ms));
  const check=()=>{const element=document.querySelector<HTMLElement>('.puppet'),canvas=element?.querySelector('canvas');if(!canvas||Number(element?.dataset.drawCalls||0)<2){later(check,150);return;}
   const frames=element!.dataset.frames,calls=Number(element!.dataset.drawCalls);later(()=>{const idle=frames===element!.dataset.frames;setHair({layers:{back2:{mode:'project',length:1,width:1,offsetY:0,distance:0,puff:.3}},extras:[]});later(()=>{const reused=canvas===element!.querySelector('canvas');setStatus(`${idle&&reused&&calls<40?'PASS':'FAIL'} · idle=${idle} · reused=${reused} · ${calls} draw calls`);},1200);},500);
  };later(check,1000);return()=>{disposed=true;timers.forEach(clearTimeout);};
 },[parts]);
 return <><p role="status">{status}</p><CreatorRollBridge request={request} onReady={()=>setRequest(1)} onResult={r=>{void decodeParts(r).then(setParts)}} onError={setStatus}/>{parts&&<Puppet parts={parts} hair={hair} yaw={60} motion="idle" wire={false} playing={false}/>}</>;
}
createRoot(document.getElementById('root')!).render(<Check/>);
