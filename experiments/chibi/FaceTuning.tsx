import React from 'react';
import {FigureSlider} from './FigureSlider';
import {cleanAdjustment,defaultAdjustment,type FacePart} from '../../apps/room3d/chibi/faceAdjustments';
import {cleanFace} from '../../apps/room3d/chibi/faceAppearance';
import type {HairSettings} from '../../apps/room3d/chibi/types';
export function FaceTuning({part,label,hair,onChange,onBegin,onEnd}:{part:FacePart;label:string;hair:HairSettings;onChange:(v:HairSettings)=>void;onBegin:()=>void;onEnd:()=>void}){
 const f=cleanFace(hair.face),a=cleanAdjustment(f.adjustments?.[part]);
 const update=(key:keyof typeof a,value:number)=>onChange({...hair,face:{...f,enabled:true,adjustments:{...f.adjustments,[part]:{...a,[key]:value}}}});
 return <div className="face-tuning" aria-label={`${label}微调`}>{(['size','width','y',...(part==='eyes'?['spacing']:[])] as Array<keyof typeof a>).map(key=>{
  const scale=key==='size'||key==='width',title={size:'大小',width:'宽窄',y:'上下',spacing:'眼距'}[key],value=scale?Math.round(a[key]*100):a[key];
  return <FigureSlider key={key} label={title} ariaLabel={label+title} min={scale?60:key==='spacing'?-16:-25} max={scale?160:key==='spacing'?16:25} step={scale?1:.5} value={value} unit={scale?'%':''} onBegin={onBegin} onEnd={onEnd} onChange={value=>update(key,value/(scale?100:1))}/>;
 })}<button className="tuning-reset" onClick={()=>onChange({...hair,face:{...f,adjustments:{...f.adjustments,[part]:{...defaultAdjustment}}}})}>重置{label}微调</button></div>;
}
