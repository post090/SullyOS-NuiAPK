import React from 'react';
import {FigureSlider} from './FigureSlider';
import {bodyProportions,type HairSettings} from '../../apps/room3d/chibi/types';
import './body-controls.css';

export function BodyControls({hair,onChange,onBegin,onEnd}:{hair:HairSettings;onChange:(v:HairSettings)=>void;onBegin:()=>void;onEnd:()=>void}){
 const values=bodyProportions(hair);
 return <div className="body-controls">
  <p>长高时腿部增长更明显，躯干略微变长，脸型保持原样。头发跟着头大小调整。</p>
  {([['headSize','头大小',75,140],['bodyHeight','身高',80,125]] as const).map(([key,label,min,max])=><FigureSlider key={key} label={label} min={min} max={max} value={Math.round(values[key]*100)} unit="%" onBegin={onBegin} onEnd={onEnd} onChange={value=>onChange({...hair,[key]:value/100})}/>)}
  <button onClick={()=>onChange({...hair,...bodyProportions()})}>重置比例</button>
 </div>;
}
