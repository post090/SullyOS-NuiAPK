import React from 'react';import {createRoot} from 'react-dom/client';
import {CreatorRollBridge} from '../../apps/room3d/chibi/CreatorRollBridge';
import {decodeParts,createVisitor} from '../../apps/room3d/chibi/visitor';
import {mountHomeEditor} from '../../apps/room3d/editor.js';
import {createHome} from '../../apps/room3d/model.js';
import '../../apps/room3d/editor.css';
function Fixture(){const [request,setRequest]=React.useState(0);return <><a href="/chibi-experiment.html" style={{position:'fixed',left:18,top:150,zIndex:20,padding:'10px 14px',borderRadius:20,background:'#fff6ee',color:'#685377',textDecoration:'none',fontSize:13}}>← 返回小屋 · 捏小人</a><div id="home"/><CreatorRollBridge request={request} onReady={()=>setRequest(1)} onError={console.error} onResult={async result=>{
 const w=window as any;if(w.__loading)return;w.__loading=true;const catalog=await fetch('/room3d/catalog.json').then(r=>r.json()),home=createHome(catalog),room=home.rooms[0];
 const item=(id:string,x:number,z:number,y=.15,supportId?:string)=>({id,assetId:id,x,y,z,rotation:0,color:null,stored:false,supportId});
 room.items=[item('daisy_table',-1.15,-.4),item('monstera',1.5,-.65)];const y=.15+catalog.find((a:any)=>a.id==='daisy_table').support.height;
 room.items.push(item('daisy_vase',-1.4,-.65,y,'daisy_table'),item('daisy_books',-.85,-.65,y,'daisy_table'),item('daisy_mug',-1.38,-.10,y,'daisy_table'),item('daisy_cookies',-.90,-.13,y,'daisy_table'));
 const editor=await mountHomeEditor(document.querySelector('#home')!,{assetBase:new URL('/room3d/',location.href).href,initialState:home}),visitor=await createVisitor(await decodeParts(result));editor.setVisitor!(visitor);
 w.__homeEditor=editor;w.__visitor=visitor;w.render_game_to_text=()=>JSON.stringify(editor.inspect!());w.advanceTime=(ms:number)=>editor.advanceTime!(ms);
 }}/></>;}
createRoot(document.querySelector('#root')!).render(<Fixture/>);
