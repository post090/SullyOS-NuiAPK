import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CreatorRollBridge} from '../../apps/room3d/chibi/CreatorRollBridge';
import {decodeParts,createVisitor,NEW_BODY_HOME_PERCENT} from '../../apps/room3d/chibi/visitor';
import {mountHomeEditor} from '../../apps/room3d/editor.js';
import {createHome,findPlace} from '../../apps/room3d/model.js';
import '../../apps/room3d/editor.css';
import {seatTransform} from '../../apps/room3d/seating.js';
import * as THREE from 'three';
function Check(){
 const [request,setRequest]=useState(0);
 return <><div id="home"/><CreatorRollBridge request={request} onReady={()=>setRequest(1)} onError={message=>{throw Error(message)}} onResult={async result=>{
  const w=window as any;if(w.__homeEditor)return;
  const catalog=await fetch('/room3d/catalog.json').then(r=>r.json()),home=createHome(catalog),room=home.rooms[0];
  room.items.push(findPlace(catalog.find((a:any)=>a.id==='petal_sofa'),room,catalog));
  room.items.push(findPlace(catalog.find((a:any)=>a.id==='petal_armchair'),room,catalog));
  const editor=await mountHomeEditor(document.querySelector('#home')!,{assetBase:new URL('/room3d/',location.href).href,initialState:home});
  const useNewBody=new URLSearchParams(location.search).has('newBody');
  const parts=await decodeParts(result),visitor=await createVisitor(parts,useNewBody?{bodyShape:'blank',layers:{},extras:[]}:undefined);
  editor.setVisitor!(visitor);
  w.updateProportions=async(proportions:{headSize:number;bodyHeight:number})=>{const next=await createVisitor(parts,{bodyShape:'blank',layers:{},extras:[],...proportions});editor.setVisitor!(next,{preservePose:true});w.__visitor=next;editor.advanceTime!(0);};
  if(useNewBody){
   const panel=document.createElement('aside');panel.setAttribute('aria-label','角色大小控制器');
   panel.style.cssText='position:fixed;right:18px;top:100px;z-index:1000;width:230px;box-sizing:border-box;padding:14px;background:#fff8f1f5;color:#5d5067;border:1px solid #d7cbdc;border-radius:12px;box-shadow:0 4px 20px #30203018;font:14px sans-serif';
   const title=document.createElement('strong');title.textContent='角色大小';
   const hint=document.createElement('p');hint.textContent='172% = 已确认的默认大小';hint.style.cssText='font-size:12px;margin:8px 0';
   const slider=document.createElement('input'),number=document.createElement('input'),unit=document.createElement('span');slider.type='range';number.type='number';unit.textContent=' %';
   for(const input of [slider,number]){input.min='30';input.max='300';input.step='1';input.setAttribute('aria-label',input===slider?'角色大小':'角色大小百分比');}
   slider.style.cssText='display:block;width:100%;margin:14px 0';number.style.cssText='width:70px;padding:5px';
   const reset=document.createElement('button');reset.textContent='重置';reset.style.cssText='margin-left:12px;padding:6px 12px';
   const key='home-newbody-scale-preview-v1';
   const apply=(value:number)=>{if(!Number.isFinite(value))return;value=THREE.MathUtils.clamp(value,30,300);slider.value=number.value=String(value);visitor.root.scale.setScalar(value/NEW_BODY_HOME_PERCENT);visitor.root.updateWorldMatrix(true,true);editor.advanceTime!(0);try{localStorage.setItem(key,String(value));}catch{}};
   slider.oninput=()=>apply(slider.valueAsNumber);number.oninput=()=>apply(number.valueAsNumber);reset.onclick=()=>apply(NEW_BODY_HOME_PERCENT);
   panel.append(title,hint,slider,number,unit,reset);document.querySelector('#root')!.append(panel);
   let saved=NEW_BODY_HOME_PERCENT;try{const value=localStorage.getItem(key);if(value!==null&&Number.isFinite(Number(value)))saved=Number(value);}catch{}apply(saved);
  }
  w.showPair=async()=>{
   const companion=await createVisitor(parts),sofa=room.items.find(i=>i.assetId==='petal_sofa')!,seat=seatTransform(room,catalog,{roomId:room.id,itemId:sofa.id,seatId:'right'})!;
   companion.animate(1,'sit');companion.root.position.fromArray(seat.position);companion.root.position.y-=companion.seatOffset;companion.root.rotation.y=seat.rotation;visitor.root.parent!.parent!.add(companion.root);
   editor.advanceTime!(0);w.__companion=companion;
   const headBounds=(root:THREE.Object3D)=>{root.updateWorldMatrix(true,true);const box=new THREE.Box3();root.traverse(o=>{if(o.name==='chibi-body'&&o instanceof THREE.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>.84)box.expandByPoint(o.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));}});return box;};
   const left=headBounds(visitor.root),right=headBounds(companion.root);return {gap:right.min.x-left.max.x};
  };
  w.__homeEditor=editor;w.__visitor=visitor;w.render_game_to_text=()=>JSON.stringify(editor.inspect!());w.advanceTime=(ms:number)=>editor.advanceTime!(ms);
 }}/></>;
}
createRoot(document.querySelector('#root')!).render(<Check/>);
