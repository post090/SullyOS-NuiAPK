import React, {useRef, useState} from 'react';
import BeautyPresetPreview, {type BeautyPreviewHandle} from './BeautyPresetPreview';
import {validateCatalogCover} from '../../utils/beautyCatalogContract';

/** Capture the same synthetic preview the author sees; never capture their real chat. */
export default function BeautyCatalogConsent({pack,cover,onCover}:{pack:unknown;cover:string;onCover:(cover:string)=>void}){
  const preview=useRef<BeautyPreviewHandle>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="beauty-catalog-consent">
    <p>审核通过后，作品、署名、联系说明、留言及预览素材会在装扮库公开，可被下载。取消公开后缓存可能短暂保留，已下载的副本无法收回。</p>
    <BeautyPresetPreview ref={preview} data={pack}/>
    <button type="button" disabled={busy} onClick={async()=>{
      setBusy(true);setError('');onCover('');
      try{
        if(!preview.current)throw Error('请等待预览载入');
        const source=await preview.current.capture();
        const canvas=document.createElement('canvas');
        const scale=Math.min(1,360/source.width,600/source.height);
        canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前设备无法生成封面');
        ctx.drawImage(source,0,0,canvas.width,canvas.height);
        onCover(validateCatalogCover(canvas.toDataURL('image/webp',.75)));
      }catch(e){setError(e instanceof Error?e.message:'封面生成失败，请重试');}finally{setBusy(false);}
    }}>{busy?'正在生成封面…':cover?'重新生成封面':'生成装扮库封面'}</button>
    {cover&&<div><img src={cover} alt="即将公开的装扮库封面" style={{maxWidth:120,maxHeight:200,objectFit:'contain'}}/><p>封面已就绪，将随作品一起审核。</p></div>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
