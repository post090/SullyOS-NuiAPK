import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CreatorRollBridge} from '../../apps/room3d/chibi/CreatorRollBridge';
import {decodeParts,createVisitor} from '../../apps/room3d/chibi/visitor';
import {mountHomeEditor} from '../../apps/room3d/editor.js';
import '../../apps/room3d/editor.css';
function Check(){
 const [request,setRequest]=useState(0);
 return <><div id="home"/><CreatorRollBridge request={request} onReady={()=>setRequest(1)} onError={message=>{throw Error(message)}} onResult={async result=>{
  const w=window as any;if(w.__loading)return;w.__loading=true;
  const editor=await mountHomeEditor(document.querySelector('#home')!,{assetBase:new URL('/room3d/',location.href).href,storageKey:'test-room3d-topology'});
  editor.setVisitor!(await createVisitor(await decodeParts(result)));
  w.__homeEditor=editor;w.render_game_to_text=()=>JSON.stringify(editor.inspect!());w.advanceTime=(ms:number)=>editor.advanceTime!(ms);
 }}/></>;
}
createRoot(document.querySelector('#root')!).render(<Check/>);
