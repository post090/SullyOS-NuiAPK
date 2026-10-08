import {PartMirrorControls,type PartMirrorProps} from './PartMirrorControls';
import React,{useState} from 'react';
import {FigureSlider} from './FigureSlider';
import {CustomPartChoices} from './CustomPartChoices';
import {defaultHairLayer,type HairSettings} from '../../apps/room3d/chibi/types';
import type {CustomCreatorPart} from '../../types';

export function FaceAccessoryControls({hair,items,selected,onSelect,onChange,onBegin,onEnd,flipped,onFlipPart}:PartMirrorProps&{hair:HairSettings;items:CustomCreatorPart[];selected:Record<string,string|string[]|null>;onSelect?:(p:CustomCreatorPart)=>void;onChange:(h:HairSettings)=>void;onBegin:()=>void;onEnd:()=>void}){
 const [category,setCategory]=useState<'facemark'|'decor'>('facemark');
 return <><nav className="face-subnav" aria-label="面饰分类">{(['facemark','decor'] as const).map(key=><button key={key} aria-pressed={category===key} onClick={()=>setCategory(key)}>{key==='facemark'?'面纹':'配饰'} · {items.filter(p=>p.categoryKey===key).length}</button>)}</nav>{[category].map(key=>{
  const label=key==='facemark'?'面纹':'配饰',layer=hair.layers[key]??defaultHairLayer;
  const update=(field:string,value:number)=>onChange({...hair,layers:{...hair.layers,[key]:{...layer,[field]:value}}});
  return <section key={key} aria-label={label+'选择与调整'}><h3>{label}</h3>
   {onSelect&&<CustomPartChoices items={items.map(p=>({...p,name:p.categoryKey===key?label+' '+p.name:p.name}))} categories={[key]} selected={selected} onSelect={onSelect}/>}
   <PartMirrorControls category={key} items={items} selected={selected} flipped={flipped} onFlipPart={onFlipPart}/>
   <p>可多选，点已选款式取下。下方调整对这一组生效。</p>
   {([['offsetY','高低',-80,80,1],['offsetX','左右',-80,80,1],['width','大小',.5,1.5,.01],['rotation','旋转',-45,45,1]] as const).map(([field,title,min,max,step])=>{
    const value=(layer as unknown as Record<string,number>)[field]??(field==='width'?1:0);
    const factor=field==='width'?100:1;
    return <FigureSlider key={field} label={title} ariaLabel={label+title} min={min*factor} max={max*factor} step={step*factor} value={Number((value*factor).toFixed(2))} unit={field==='width'?'%':''} onBegin={onBegin} onEnd={onEnd} onChange={value=>update(field,value/factor)}/>;
   })}
   <button onClick={()=>onChange({...hair,layers:{...hair.layers,[key]:{...defaultHairLayer}}})}>重置{label}位置</button>
  </section>;
 })}</>;
}
