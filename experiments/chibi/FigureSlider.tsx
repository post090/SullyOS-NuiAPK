import React,{useEffect,useRef,useState} from 'react';
import './figure-slider.css';

export function FigureSlider({label,ariaLabel=label,value,min,max,step=1,unit='',digits,onChange,onBegin,onEnd}:{
 label:string;ariaLabel?:string;value:number;min:number;max:number;step?:number;unit?:string;digits?:number;
 onChange:(value:number)=>void;onBegin?:()=>void;onEnd?:()=>void;
}){
 const precision=digits??(String(step).split('.')[1]?.length??0);
 const format=(n:number)=>n.toFixed(precision);
 const [draft,setDraft]=useState(()=>format(value));
 const cancelled=useRef(false);
 useEffect(()=>setDraft(value.toFixed(precision)),[value,precision]);
 const commit=()=>{
  const parsed=Number(draft);
  const valid=!cancelled.current&&draft.trim()!==''&&Number.isFinite(parsed);
  const next=valid?Number(Math.max(min,Math.min(max,min+Math.round((parsed-min)/step)*step)).toFixed(precision)):value;
  cancelled.current=false;setDraft(format(next));
  if(next!==value)onChange(next);
  onEnd?.();
 };
 const adjustmentKey=(key:string)=>/^(Arrow|Page|Home|End)/.test(key);
 return <div className="creator-slider figure-slider">
  <span>{label}</span>
  <input type="range" aria-label={ariaLabel} min={min} max={max} step={step} value={value}
   onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);onBegin?.();}}
   onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd} onBlur={onEnd}
   onKeyDown={e=>{if(!e.repeat&&adjustmentKey(e.key))onBegin?.();}} onKeyUp={e=>{if(adjustmentKey(e.key))onEnd?.();}}
   onChange={e=>{const next=Number(e.target.value);if(next!==value)onChange(next);}}/>
  <div className="figure-number"><input type="number" aria-label={`${ariaLabel}数值`} inputMode={min<0?'text':'decimal'}
   min={min} max={max} step={step} value={draft} onFocus={onBegin} onChange={e=>setDraft(e.target.value)}
   onBlur={commit} onKeyDown={e=>{
    if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}
    if(e.key==='Escape'){e.preventDefault();cancelled.current=true;e.currentTarget.blur();}
   }}/>{unit&&<small>{unit}</small>}</div>
 </div>;
}
