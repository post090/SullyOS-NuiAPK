import React,{useEffect,useRef} from 'react';
import {DECORATION_UPDATE_KEY} from '../../utils/decorationGuide';
import './DecorationGuide.css';
export default function DecorationUpdatePopup({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 const close=()=>{try{localStorage.setItem(DECORATION_UPDATE_KEY,'1');}catch{}onClose();};
 return <dialog ref={dialog} className="dress-update" aria-labelledby="dress-update-title" onCancel={e=>{e.preventDefault();close();}}>
  <div className="dress-update-content"><div className="dress-update-kicker">CHATAPP · 换装时间</div><h2 id="dress-update-title">喜欢的装扮，<br/>终于聚在一起。</h2><p>白框也搬进来了。制作、收藏、搭配和分享，现在都在「聊天装扮」。</p>
   <div className="dress-update-demo" aria-hidden="true"><span className="dress-update-bubble">给聊天换个喜欢的样子。</span><span className="dress-update-bubble">这一套，就很像我们 ♡</span></div>
   <nav aria-label="整合的装扮分类">{['白框','气泡','头像框','聊天背景','心象','提示音'].map(s=><span key={s}>{s}</span>)}</nav>
   <p>「我的」查看当前角色的搭配；导入喜欢的作品，或到统一作者页分享你的创作。原有设置和收藏都会保留。</p>
  </div><footer><button autoFocus onClick={close}>知道了</button><small>聊天 → ＋ → 聊天装扮 · 首次进入会有操作引导</small></footer>
 </dialog>;
}
