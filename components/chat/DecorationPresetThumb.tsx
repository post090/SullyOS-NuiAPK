import React,{useEffect,useMemo,useRef,useState} from 'react';
import BeautyPresetPreview from '../share/BeautyPresetPreview';
import type {WardrobeEntry} from '../appearance/BeautyWardrobe';
import {validateDecoration,type DecorationPreset} from '../../utils/chatDecoration';
import {PRESET_THEMES} from './ChatConstants';

export type DecorationShelf='whitebox'|'bubbles'|'avatar'|'background'|'psyche'|'sound'|'schedule'|'journal'|'date'|'story';

/** Show the selected part using the same renderer as the main preview. */
export function DecorationMiniPreview({preset,category}:{preset:DecorationPreset;category:DecorationShelf}){
 const sample=useMemo(()=>{
  if(category==='whitebox')return preset;
  const parts:DecorationPreset['parts']=category==='date'?{date:preset.parts.date||{preset:'none'}}:category==='story'?{story:preset.parts.story||{preset:'none'}}:category==='journal'?{journal:preset.parts.journal||{preset:'original'}}:category==='schedule'?{schedule:preset.parts.schedule||{preset:'original'}}:category==='psyche'?{psyche:preset.parts.psyche||{styleId:'echo'}}:
   category==='avatar'?{bubbles:preset.parts.bubbles||PRESET_THEMES.default,css:preset.parts.css}:category==='bubbles'?{bubbles:preset.parts.bubbles||PRESET_THEMES.default}:
   category==='background'?{background:preset.parts.background||{image:null,style:'plain'},css:preset.parts.css}:{};
  return {...preset,parts};
 },[preset,category]);
 if(category==='sound')return <div className="decoration-sound-thumb" aria-hidden="true"><svg viewBox="0 0 80 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M8 21v6m10-12v18m11-23v28m11-34v40m11-32v24m11-19v14m10-10v6"/></svg><small>{preset.parts.sound?.src&&preset.parts.sound.src!=='none'?'消息提示音':'默认提示音'}</small></div>;
 return <div className="decoration-mini-preview" aria-hidden="true"><BeautyPresetPreview data={sample} compact thumbnailPart={category==='whitebox'?'full':category}/></div>;
}

export default function DecorationPresetThumb({entry,category,disabled,onChoose}:{entry:WardrobeEntry;category:DecorationShelf;disabled:boolean;onChoose:()=>void}){
 const read=useRef(entry.read);read.current=entry.read;
 const [preset,setPreset]=useState<DecorationPreset|null>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{let alive=true;setPreset(null);setError(false);Promise.resolve().then(()=>read.current()).then(value=>{if(alive)setPreset(validateDecoration(value));}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[entry.id,entry.revision]);
 return <button className="decoration-preset-tile" aria-label={`选择 ${entry.name}`} disabled={disabled} onClick={onChoose}>
  <span className="decoration-preset-tile-image" data-category={category}>{preset?<DecorationMiniPreview preset={preset} category={category}/>:<span className="decoration-thumbnail-loading">{error?'预览暂不可用':'载入预览…'}</span>}</span>
  <strong>{entry.name}</strong><small>选择这款 <span aria-hidden="true">↗</span></small>
 </button>;
}
