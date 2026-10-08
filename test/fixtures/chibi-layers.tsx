import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CreatorRollBridge,type RollResult} from '../../apps/room3d/chibi/CreatorRollBridge';
function Check(){
 const [request,setRequest]=useState(0),[first,setFirst]=useState<RollResult>(),[status,setStatus]=useState('Loading native creator…');
 return <><CreatorRollBridge request={request} savedState={first?.state} onReady={()=>setRequest(1)} onError={setStatus} onResult={result=>{
  if(!first){setFirst(result);setRequest(2);setStatus('Restoring the same saved selections and colors…');}
  else setStatus(JSON.stringify(result.layers)===JSON.stringify(first.layers)?'PASS: saved selections, colors and all rendered layers match the original roll.':'FAIL: restored layers differ');
 }}/><p role="status">{status}</p>{first&&<img src={first.image} width="250"/>}</>;
}
createRoot(document.getElementById('root')!).render(<Check/>);
