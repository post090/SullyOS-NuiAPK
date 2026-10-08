import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,MagnifyingGlassPlus,X} from '@phosphor-icons/react';
import {HOME_UPDATE_KEY,HOME_UPDATE_PAGES} from '../../utils/homeUpdate';
import './home-update.css';

function ScreenshotZoom({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={dialog} className="home-release-zoom" aria-label="截图大图" onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}}><button autoFocus onClick={onClose}>收起大图 <X size={19}/></button>{children}</dialog>;
}

export default function HomeUpdatePopup({onDone,onVisit,onGuide}:{onDone:()=>void;onVisit:()=>void;onGuide:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),scroll=useRef<HTMLDivElement>(null);
 const [page,setPage]=useState(0),[zoom,setZoom]=useState(false),[failed,setFailed]=useState(false);
 const item=HOME_UPDATE_PAGES[page];
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
 useEffect(()=>{scroll.current?.scrollTo?.({top:0});setFailed(false);},[page]);
 const finish=(callback:()=>void)=>{try{localStorage.setItem(HOME_UPDATE_KEY,'1');}catch{/* Closing remains available when storage is full. */}callback();};
 const image=<img src={`${import.meta.env.BASE_URL}assets/updates/home3d-beta/${item.image}`} alt={item.alt} onError={()=>setFailed(true)} draggable={false}/>;
 return <dialog ref={dialog} className="home-release" aria-labelledby="home-release-title" onCancel={event=>{event.preventDefault();if(zoom)setZoom(false);else finish(onDone);}}>
  <header className="home-release-header"><span>SullyOS · 糯米机</span><span>大型更新 / 3D 家园 <b>测试版</b></span><button aria-label="关闭家园更新介绍" onClick={()=>finish(onDone)}><X size={20}/></button></header>
  <div ref={scroll} className="home-release-scroll">
   <div key={page} className="home-release-page">
    <figure className={`home-release-figure ${page===0?'home-release-cover':''}`}><button className="home-release-shot" aria-label={`放大截图：${item.label}`} onClick={()=>setZoom(true)} disabled={failed}>{failed?<span>截图暂时未加载，可先阅读下方说明。</span>:image}<span className="home-release-enlarge"><MagnifyingGlassPlus size={16}/> 点图放大</span></button><figcaption>实际界面 · 演示角色与对话</figcaption></figure>
    <div className="home-release-copy"><p className="home-release-kicker">0{page+1} / {item.label}</p><h2 id="home-release-title">{item.title}</h2><p className="home-release-text">{item.text}</p><p className="home-release-route">{item.route}</p><p className="home-release-note">{item.note}</p>{page===0&&<p className="home-release-beta">测试版持续打磨中。首次进入先确定家园设定、配色和双方形象。</p>}</div>
   </div>
  </div>
  <footer className="home-release-footer"><nav aria-label="家园更新介绍分页">{HOME_UPDATE_PAGES.map((entry,i)=><button key={entry.label} aria-label={`第 ${i+1} 页：${entry.label}`} aria-current={page===i?'step':undefined} onClick={()=>setPage(i)}><span/></button>)}</nav><div className="home-release-actions"><button className="home-release-back" disabled={page===0} onClick={()=>setPage(page-1)} aria-label="上一页"><ArrowLeft size={19}/></button>{page<HOME_UPDATE_PAGES.length-1?<button className="home-release-primary" onClick={()=>setPage(page+1)}>下一页 <ArrowRight size={18}/></button>:<button className="home-release-primary" onClick={()=>finish(onVisit)}>去 3D 家园看看 <ArrowRight size={18}/></button>}</div><button className="home-release-guide" onClick={()=>finish(onGuide)}>完整图文说明</button></footer>
  {zoom&&<ScreenshotZoom onClose={()=>setZoom(false)}>{image}<p>{item.route}</p></ScreenshotZoom>}
 </dialog>;
}
