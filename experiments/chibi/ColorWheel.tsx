import React,{useEffect,useRef,useState} from 'react';
import {hexToWheel,wheelAt,wheelToHex,type WheelColor} from '../../utils/colorWheel';
import './color-wheel.css';

export function ColorWheel({label,value,onChange,onBegin,onEnd}:{label:string;value:string;onChange:(value:string)=>void;onBegin:()=>void;onEnd:()=>void}){
 const [color,setColor]=useState(()=>hexToWheel(value));
 const panel=useRef<HTMLDivElement>(null);
 const latest=useRef(color),drag=useRef<number|null>(null),brightness=useRef(false);
 const changeRef=useRef(onEnd);changeRef.current=onEnd;
 const update=(next:WheelColor)=>{latest.current=next;setColor(next);};
 useEffect(()=>{if(wheelToHex(latest.current)===value)return;const next=hexToWheel(value);if(next.s===0)next.h=latest.current.h;update(next);},[value]);
 useEffect(()=>()=>{if(drag.current!==null||brightness.current)changeRef.current();},[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>panel.current?.scrollIntoView?.({block:'nearest'}));return()=>cancelAnimationFrame(frame);},[]);
 const commit=()=>{const next=wheelToHex(latest.current);if(next!==value)onChange(next);onEnd();};
 const point=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();update(wheelAt((e.clientX-r.left-r.width/2)/(r.width/2),(e.clientY-r.top-r.height/2)/(r.height/2),latest.current));};
 const cancel=()=>{if(drag.current===null)return;drag.current=null;update(hexToWheel(value));onEnd();};
 const angle=color.h*Math.PI/180;
 return <div className="figure-color-wheel" ref={panel}>
  <div className="figure-color-disk" role="slider" tabIndex={0} aria-label={`${label}色环`} aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(color.h)} aria-valuetext={`色相 ${Math.round(color.h)}，饱和度 ${Math.round(color.s*100)}%`} style={{'--wheel-brightness':color.v} as React.CSSProperties}
   onPointerDown={e=>{if(e.button!==0||drag.current!==null)return;drag.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);onBegin();point(e);}}
   onPointerMove={e=>{if(drag.current===e.pointerId)point(e);}}
   onPointerUp={e=>{if(drag.current!==e.pointerId)return;point(e);drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);commit();}}
   onPointerCancel={cancel} onLostPointerCapture={cancel}
   onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();onBegin();const c=latest.current;update({...c,h:(c.h+(e.key==='ArrowLeft'?-3:e.key==='ArrowRight'?3:0)+360)%360,s:e.key==='Home'?0:e.key==='End'?1:Math.max(0,Math.min(1,c.s+(e.key==='ArrowUp'?.03:e.key==='ArrowDown'?-.03:0)))});commit();}}>
   <i style={{left:`${50+Math.cos(angle)*color.s*50}%`,top:`${50+Math.sin(angle)*color.s*50}%`,backgroundColor:wheelToHex(color)}}/>
  </div>
  <div className="figure-color-result"><span style={{background:wheelToHex(color)}}/><output>{wheelToHex(color).toUpperCase()}</output><small>拖动选色 · 松手应用</small></div>
  <label className="figure-color-light">明暗<input type="range" min="0" max="100" aria-label={`${label}明暗`} value={Math.round(color.v*100)} style={{'--wheel-track':`linear-gradient(to right,#000,${wheelToHex({...color,v:1})})`} as React.CSSProperties} onChange={e=>{if(!brightness.current){brightness.current=true;onBegin();}update({...latest.current,v:Number(e.target.value)/100});}} onPointerUp={()=>{if(brightness.current){brightness.current=false;commit();}}} onKeyUp={()=>{if(brightness.current){brightness.current=false;commit();}}} onBlur={()=>{if(brightness.current){brightness.current=false;commit();}}} onPointerCancel={()=>{brightness.current=false;update(hexToWheel(value));onEnd();}}/><output>{Math.round(color.v*100)}%</output></label>
 </div>;
}
