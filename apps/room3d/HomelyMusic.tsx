import React,{useEffect,useState} from 'react';
import {Minus,MusicNotes,Pause,Play,SkipForward} from '@phosphor-icons/react';
import {useMusic} from '../../context/MusicContext';
import {useOS} from '../../context/OSContext';
import {AppID} from '../../types';
import TokenImg from '../../components/os/TokenImg';
import type {HomeEditor} from './editor';

export default function HomelyMusic({editor,visible=true,active=true}:{editor:HomeEditor;visible?:boolean;active?:boolean}) {
  const {current,playing,progress,duration,loadingSong,togglePlay,nextSong,queue}=useMusic();
  const {openApp}=useOS();
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{editor.setHomelyMusic?.({playing:active&&playing&&!loadingSong,position:progress});},[editor,active,playing,loadingSong,progress,current?.id]);
  useEffect(()=>()=>editor.setHomelyMusic?.({playing:false,position:0}),[editor]);
  if(!visible||!current)return null;
  if(!expanded)return <section className="homely-music homely-music-compact" aria-label="音乐播放器"><button className="homely-music-summary" aria-label={`展开音乐播放器：${current.name}`} aria-expanded={false} onClick={()=>setExpanded(true)}><MusicNotes size={14}/><span>{current.name}</span></button><button className="homely-music-toggle" onClick={togglePlay} disabled={loadingSong} aria-label={playing?'暂停音乐':'播放音乐'}>{playing?<Pause size={15} weight="fill"/>:<Play size={15} weight="fill"/>}</button></section>;
  return <section className="homely-music" aria-label="音乐播放器">
    <button className="homely-music-collapse" aria-label="收起音乐播放器" aria-expanded={true} onClick={()=>setExpanded(false)}><Minus size={18}/></button>
    <button className="homely-music-track" onClick={()=>openApp(AppID.Music)} aria-label={`打开音乐：${current.name}`}>
      <span className="homely-music-cover">{current.albumPic?<TokenImg value={current.albumPic}/>:<MusicNotes size={20}/>}</span>
      <span><strong>{current.name}</strong><small>{current.artists||'音乐'}</small></span>
    </button>
    <div className="homely-music-controls"><span>{loadingSong?'加载中':playing?'一起听着':'已暂停'}</span><button onClick={togglePlay} disabled={loadingSong} aria-label={playing?'暂停音乐':'播放音乐'}>{playing?<Pause size={19} weight="fill"/>:<Play size={19} weight="fill"/>}</button><button onClick={nextSong} disabled={loadingSong||queue.length<2} aria-label="下一首"><SkipForward size={19} weight="fill"/></button></div>
    <progress aria-label="音乐播放进度" max={Math.max(1,duration)} value={Math.min(progress,Math.max(1,duration))}/>
  </section>;
}
