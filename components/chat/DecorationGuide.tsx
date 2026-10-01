import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import './DecorationGuide.css';
const steps=[
 ['collection','你的聊天装扮，都在这里','这里展示你制作和导入的白框、气泡、头像框、聊天背景、心象与提示音。按分类挑选，点开就能预览。','下一步'],
 ['mine','看看当前角色穿了什么','点右上角「我的」，进入这个角色的搭配。',''],
 ['outfit','这是当前聊天角色的搭配','搭配栏里可以自由组合已收藏的作品。「保存当前搭配」只存入搭配栏，不会混进外面的作品预设。这里的预览使用示例聊天。','知道了'],
 ['outfit-back','回到你的作品收藏','点左上角「返回」，再认识一下导入和分享。',''],
 ['import','把喜欢的装扮带回来','点击「导入装扮」。分享码、CSS、文件和分享图片，都从同一个入口导入。',''],
 ['import-page','一种入口，多种导入方式','分享码会自动识别类型；旧 CSS 没有署名时，先确认自制或外部导入。文件与相册也可以分别选择。','看看分享'],
 ['share','把自己的创作分享出去','点击「分享装扮」，进入统一的作者页面。',''],
 ['share-page','文件、图片，或一枚分享码','文件分享和图片分享可直接导出。码分享需要投稿审核，通过后获得专属码；所有分类的作品和提交都在同一个作者页面。','完成引导'],
] as const;
export default function DecorationGuide({step,onNext,onSkip}:{step:number;onNext:()=>void;onSkip:()=>void}){
 const item=steps[step];const [blocked,setBlocked]=useState(()=>!!document.querySelector('dialog[open]'));
 useEffect(()=>{const check=()=>setBlocked(!!document.querySelector('dialog[open]'));const observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});check();return()=>observer.disconnect();},[]);
 const [rect,setRect]=useState<{left:number;top:number;width:number;height:number}|null>(null);
 useEffect(()=>{
  setRect(null);
  if(!item||blocked)return;
  const target=document.querySelector<HTMLElement>(`[data-dress-guide="${item[0]}"]`);
  if(!target)return;
  target.scrollIntoView?.({block:'nearest',inline:'nearest'});
  const place=()=>{const r=target.getBoundingClientRect();setRect({left:r.left,top:r.top,width:r.width,height:r.height});};
  const observer=new ResizeObserver(place);observer.observe(target);place();
  window.addEventListener('resize',place);document.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);};
 },[step,item,blocked]);
 if(!item||blocked)return null;
 return createPortal(<div className="dress-guide-layer">
  {rect&&<div aria-hidden="true" className="dress-guide-focus" style={rect}/>}
  <section role="region" aria-label="聊天装扮使用引导" aria-live="polite" className="dress-guide-note">
   <header><small>认识聊天装扮 · {step+1}/{steps.length}</small><button onClick={onSkip}>跳过引导</button></header>
   <h3>{item[1]}</h3><p>{item[2]}</p>
   {item[3]?<button className="dress-guide-next" onClick={onNext}>{item[3]} →</button>:<small className="dress-guide-wait">轻点高亮的按钮，继续体验</small>}
  </section>
 </div>,document.body);
}
