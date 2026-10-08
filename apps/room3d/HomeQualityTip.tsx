import React,{useEffect,useRef,useState} from 'react';
import type {HomeEditor} from './editor.js';

const TIP_KEY='sully-home3d-quality-tip-v1';
export default function HomeQualityTip({editor,active}:{editor:HomeEditor;active:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [seen,setSeen]=useState(()=>{try{return localStorage.getItem(TIP_KEY)==='seen';}catch{return false;}});
 useEffect(()=>{const el=dialog.current;if(!el)return;if(active&&!seen){if(!el.open)el.showModal();}else if(el.open)el.close();},[active,seen]);
 const dismiss=()=>{try{localStorage.setItem(TIP_KEY,'seen');}catch{}setSeen(true);};
 return <dialog ref={dialog} className="home-quality-tip" aria-labelledby="home-quality-tip-title" onCancel={dismiss}>
  <h2 id="home-quality-tip-title">画质可以随时调整</h2>
  <p>清晰画质优先看清小人的五官。想减少发热或耗电，可以试试均衡或省电。</p>
  <p>点房间顶部的「画质」就能调整，选择会记在这台设备上。</p>
  <div><button type="button" onClick={dismiss}>知道了</button><button type="button" onClick={()=>{dismiss();editor.openPanel('quality');}}>调整画质</button></div>
 </dialog>;
}
