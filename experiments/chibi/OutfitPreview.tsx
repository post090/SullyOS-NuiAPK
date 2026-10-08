import React,{useEffect,useRef,useState} from 'react';
import type {HairSettings,Parts} from '../../apps/room3d/chibi/types';
import {outfitClothes} from '../../apps/room3d/chibi/outfitLibrary';

/** Only visible outfits enter the single-renderer queue, including imported outfits. */
export function OutfitPreview({hair,parts,name}:{hair:HairSettings;parts?:Parts;name:string}) {
 const host=useRef<HTMLSpanElement>(null);
 const [visible,setVisible]=useState(false),[image,setImage]=useState(''),[error,setError]=useState(false);
 const key=JSON.stringify([outfitClothes(hair),hair.headSize,hair.bodyHeight,hair.skinColor]);
 useEffect(()=>{
  if(typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'80px'});
  observer.observe(host.current!);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!visible||!parts)return;
  const controller=new AbortController();setImage('');setError(false);
  import('./outfitThumbnail').then(({renderOutfitThumbnail})=>renderOutfitThumbnail(hair,parts,controller.signal)).then(src=>{if(!controller.signal.aborted)setImage(src);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[key,parts,visible]);
 return <span ref={host} className="outfit-preview outfit-worn-preview" aria-label={`${name}整套穿着预览`}>
  {image?<img src={image} alt={`${name} · 实际配色与版型`}/>:<span role="status">{error?'预览暂不可用':'准备试衣预览…'}</span>}
 </span>;
}
