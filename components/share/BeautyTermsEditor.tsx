import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {BeautySubmission,BeautyMetadata} from '../../utils/beautyShareContract';
import {beautyRequest,type BeautySession} from '../../utils/beautyShareClient';
import {readBeautyBinding,bindBeautySource} from '../../utils/beautySourceBinding';
import './BeautyConfirmDialog.css';

type Result={ok:boolean;message:string};
/** Patch only selected protocol fields. Public visibility is never part of a bulk edit. */
export default function BeautyTermsEditor({items,session,onClose,onDone}:{items:BeautySubmission[];session:BeautySession;onClose:()=>void;onDone:()=>Promise<void>}){
  const single=items.length===1,first=items[0].metadata;
  const [remix,setRemix]=useState(single?String(first.allowRemix):'keep');
  const [redistribute,setRedistribute]=useState(single?String(first.allowRedistribute):'keep');
  const [feedback,setFeedback]=useState(single?first.bugFeedback:'keep');
  const [editMessage,setEditMessage]=useState(single),[message,setMessage]=useState(single?first.message:'');
  const [results,setResults]=useState<Record<string,Result>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const ref=useRef<HTMLDialogElement>(null),inFlight=useRef(false);
  useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
  const completed=items.every(item=>results[item.id]?.ok);
  return createPortal(<dialog ref={ref} className="beauty-confirm-dialog beauty-terms-editor" aria-label="修改使用协议" onCancel={e=>{e.preventDefault();if(!inFlight.current)onClose();}}>
    <h3>{single?'修改使用协议':`批量修改协议 · ${items.length} 份`}</h3>
    <div className="beauty-confirm-body"><p>沿用各作品已审核的文件和分享码，只修改下方约定。新协议仍需人工审核，通常 1–2 天；通过前继续使用旧协议。</p>
      <fieldset disabled={busy||Object.keys(results).length>0}>
        <label>二改许可<select value={remix} onChange={e=>setRemix(e.target.value)}><option value="keep">保持各作品原设置</option><option value="true">允许二改</option><option value="false">禁止二改</option></select></label>
        <label>二次传播<select value={redistribute} onChange={e=>setRedistribute(e.target.value)}><option value="keep">保持各作品原设置</option><option value="true">允许二次传播</option><option value="false">禁止二次传播</option></select></label>
        <label>Bug 反馈<select value={feedback} onChange={e=>setFeedback(e.target.value)}><option value="keep">保持各作品原设置</option><option value="welcome">欢迎反馈</option><option value="self-fix">请自行修复处理</option></select></label>
        <label className="beauty-share-check"><input type="checkbox" checked={editMessage} onChange={e=>setEditMessage(e.target.checked)}/>{single?'修改作者留言 / 补充约定':'统一替换作者留言 / 补充约定'}</label>
        {editMessage&&<textarea aria-label="作者留言与补充约定" rows={4} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}/>}
      </fieldset>
      <p>公开展示授权保持各作品原设置。已领取的用户需要检查更新并确认新协议，本机旧副本不会被远程改写。</p>
      <ul>{items.map(item=><li key={item.id}>{item.metadata.name}{results[item.id]&&<span role="status"> · {results[item.id].message}</span>}</li>)}</ul>
      {error&&<p role="alert">{error}</p>}
    </div>
    <footer><button disabled={busy} onClick={onClose}>{completed?'完成':'关闭'}</button><button disabled={busy||completed} onClick={async()=>{
      if(inFlight.current)return;
      const terms:Partial<BeautyMetadata>={};
      if(remix!=='keep')terms.allowRemix=remix==='true';if(redistribute!=='keep')terms.allowRedistribute=redistribute==='true';
      if(feedback!=='keep')terms.bugFeedback=feedback as BeautyMetadata['bugFeedback'];if(editMessage)terms.message=message;
      if(!Object.keys(terms).length){setError('请至少选择一项需要修改的约定');return;}
      inFlight.current=true;setBusy(true);setError('');
      try{
        // Sequential requests bound backend load. Successful items are not resubmitted on retry.
        for(const item of items){if(results[item.id]?.ok)continue;
          try{
            const result=await beautyRequest<{revision:string;unchanged?:boolean}>(`/submissions/${item.id}/terms`,{method:'POST',token:session.token,body:{terms,expectedRevision:item.latestRevision}});
            let bindingWarning=false;
            if(!result.unchanged)try{const binding=await readBeautyBinding(session.authorCode,item.id);if(binding?.revision===item.latestRevision&&item.latestRevision===item.publishedRevision)await bindBeautySource(session.authorCode,item.id,{...binding,revision:result.revision});}catch{bindingWarning=true;}
            setResults(v=>({...v,[item.id]:{ok:true,message:result.unchanged?'协议未变化，无需提交':bindingWarning?'已送审；本机关联更新失败，请勿重复提交':'已送交人工审核'}}));
          }catch(e){setResults(v=>({...v,[item.id]:{ok:false,message:e instanceof Error?e.message:'提交失败，可重试'}}));}
        }
        try{await onDone();}catch{setError('提交结果已列出，列表刷新失败，请稍后手动刷新。');}
      }finally{inFlight.current=false;setBusy(false);}
    }}>{busy?'正在提交…':completed?'已处理':Object.keys(results).length?'重试未成功的作品':'提交协议修改'}</button></footer>
  </dialog>,document.body);
}
