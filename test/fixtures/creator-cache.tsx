import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CreatorRollBridge,type RollResult} from '../../apps/room3d/chibi/CreatorRollBridge';
import {testCharacter} from './room3d-test-character';
export function capture(host:HTMLElement):Promise<RollResult>{return new Promise((resolve,reject)=>{const root=createRoot(host);function Capture(){const [request,setRequest]=useState(0);return <CreatorRollBridge request={request} savedState={testCharacter.state} extraItems={[]} onReady={()=>setRequest(1)} onResult={result=>{setTimeout(()=>{root.unmount();resolve(result);},0);}} onError={error=>{root.unmount();reject(Error(error));}}/>;}root.render(<Capture/>);});}
