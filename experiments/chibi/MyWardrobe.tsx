import {OutfitPreview} from './OutfitPreview';
import React,{useEffect,useRef,useState} from 'react';
import {Plus,DownloadSimple,UploadSimple,PencilSimple,Trash,TShirt} from '@phosphor-icons/react';
import {DB} from '../../utils/db';
import {makeOutfit,applyOutfit,exportOutfit,importOutfit,OUTFIT_LIMIT,type SavedOutfit} from '../../apps/room3d/chibi/outfitLibrary';
import type {HairSettings,Parts} from '../../apps/room3d/chibi/types';
import './my-wardrobe.css';

export function MyWardrobe({parts,hair,onChange}:{parts?:Parts;hair:HairSettings;onChange:(hair:HairSettings)=>void}){
 const [items,setItems]=useState<SavedOutfit[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [form,setForm]=useState<{id?:string;name:string}|null>(null),[deleting,setDeleting]=useState<string|null>(null);
 const upload=useRef<HTMLInputElement>(null),saving=useRef(false);
 useEffect(()=>{let active=true;DB.getUserProfile().then(p=>{if(active){setItems(p?.wardrobeOutfits??[]);setReady(true);}}).catch(()=>{if(active)setMessage('衣柜读取失败，请重新打开');});return()=>{active=false;};},[]);
 const update=async(fn:(items:SavedOutfit[])=>SavedOutfit[],success:string)=>{
  if(saving.current)return;saving.current=true;setBusy(true);setMessage('');
  try{const next=await DB.updateWardrobeOutfits(fn);setItems(next);setMessage(success);setForm(null);setDeleting(null);}catch(e){setMessage(e instanceof Error?e.message:'未能保存，请重试');}finally{saving.current=false;setBusy(false);}
 };
 const add=(outfit:SavedOutfit)=>update(old=>{if(old.length>=OUTFIT_LIMIT)throw Error('衣柜已满，请先删除不需要的搭配');return [...old,outfit];},'搭配已收入衣柜');
 const download=(item:SavedOutfit)=>{const url=URL.createObjectURL(new Blob([exportOutfit(item)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${item.name.replace(/[\\/:*?"<>|]/g,'_')}.sully-outfit.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="my-wardrobe" aria-label="我的衣柜">
  <div className="my-wardrobe-tools"><button disabled={!ready||busy} onClick={()=>setForm({name:''})}><Plus size={18}/>保存当前搭配</button><button disabled={!ready||busy} onClick={()=>upload.current?.click()}><UploadSimple size={18}/>导入</button></div>
  <input ref={upload} hidden type="file" accept=".json,.sully-outfit.json,application/json" aria-label="导入搭配文件" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>256_000)throw Error('搭配文件过大');await add(importOutfit(await file.text()));}catch(error){setMessage(error instanceof Error?error.message:'导入失败');}}}/>
  {form&&<form className="my-wardrobe-name" onSubmit={e=>{e.preventDefault();try{if(form.id){const name=form.name.trim().slice(0,40);if(!name)throw Error('给这套搭配起个名字吧');void update(old=>old.map(item=>item.id===form.id?{...item,name}:item),'名称已修改');}else void add(makeOutfit(form.name,hair));}catch(error){setMessage((error as Error).message);}}}><input autoFocus aria-label="搭配名称" placeholder="给搭配起个名字" maxLength={40} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><button disabled={busy} type="submit">保存</button><button type="button" disabled={busy} onClick={()=>setForm(null)}>取消</button></form>}
  {message&&<p role="status">{message}</p>}
  {!ready&&!message&&<p>正在打开衣柜…</p>}
  {ready&&!items.length&&<div className="my-wardrobe-empty"><TShirt size={36}/><p>喜欢这身搭配？把它收进衣柜。</p><small>衣服、配饰、配色与版型一起保存</small></div>}
  <div className="my-outfit-grid">{items.map(item=><article key={item.id}>
   <button className="my-outfit-wear" aria-label={`穿上${item.name}`} onClick={()=>{onChange(applyOutfit(hair,item));setMessage(`已穿上「${item.name}」`);}}><OutfitPreview name={item.name} parts={parts} hair={applyOutfit(hair,item)}/><strong>{item.name}</strong></button>
   <div className="my-outfit-actions"><button aria-label={`重命名${item.name}`} disabled={busy} onClick={()=>setForm({id:item.id,name:item.name})}><PencilSimple size={17}/></button><button aria-label={`导出${item.name}`} onClick={()=>download(item)}><DownloadSimple size={17}/></button><button aria-label={`删除${item.name}`} disabled={busy} onClick={()=>setDeleting(item.id)}><Trash size={17}/></button></div>
   {deleting===item.id&&<div className="my-outfit-confirm"><span>删除这套搭配？</span><button disabled={busy} onClick={()=>void update(old=>old.filter(o=>o.id!==item.id),'搭配已删除')}>删除</button><button onClick={()=>setDeleting(null)}>取消</button></div>}
  </article>)}</div>
  {!!items.length&&<small>点搭配穿上 · 下载文件即可分享</small>}
 </section>;
}
