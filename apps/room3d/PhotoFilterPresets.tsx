import {createLocalId} from '../../utils/localId.js';
import React,{useState} from 'react';
import type {PhotoLook} from './photoEffects';
import {readPhotoLooks,writePhotoLooks,samePhotoLook,type SavedPhotoLook} from './photoLookStorage';

export default function PhotoLookLibrary({look,onApply}:{look:PhotoLook;onApply:(look:PhotoLook)=>void}){
 const [items,setItems]=useState(readPhotoLooks),[name,setName]=useState(''),[error,setError]=useState(''),[removed,setRemoved]=useState<SavedPhotoLook>();
 const commit=(next:SavedPhotoLook[])=>{try{writePhotoLooks(next);setItems(next);setError('');return true;}catch{setError('预设保存失败，本地存储可能已满。');return false;}};
 const save=()=>{const title=name.trim();if(!title)return;if(items.length>=60){setError('最多保存 60 组预设，请先移除不需要的预设。');return;}if(commit([...items,{id:createLocalId(),name:title,look:{...look}}]))setName('');};
 return <details className="photo-look-library"><summary>我的滤镜库 <span>{items.length} 组</span></summary>
  <p>保存当前色调和四项参数，下次拍照也能用。</p>
  <form onSubmit={e=>{e.preventDefault();save();}}><input aria-label="滤镜预设名称" placeholder="给这组滤镜起个名字" maxLength={24} value={name} onChange={e=>setName(e.target.value)}/><button disabled={!name.trim()} type="submit">保存当前</button></form>
  {!items.length&&<p>还没有收藏的滤镜，调到喜欢的效果就存下来吧。</p>}
  {items.map(item=><div className="photo-look-row" key={item.id}>
   <button className="photo-look-apply" aria-pressed={samePhotoLook(look,item.look)} onClick={()=>onApply({...item.look})}><strong>{item.name}</strong><span>{item.look.glow.toFixed(2)} / {item.look.fringe.toFixed(2)} / {item.look.vignette.toFixed(2)} / {item.look.exposure.toFixed(2)}</span></button>
   <button aria-label={`删除滤镜 ${item.name}`} onClick={()=>{if(commit(items.filter(p=>p.id!==item.id)))setRemoved(item);}}>×</button>
  </div>)}
  {removed&&<p>已移除「{removed.name}」<button onClick={()=>{if(commit([...items,removed]))setRemoved(undefined);}}>撤销</button></p>}
  {error&&<p role="alert">{error}</p>}
 </details>;
}
