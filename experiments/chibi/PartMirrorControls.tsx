import React from 'react';
import {ArrowsLeftRight} from '@phosphor-icons/react';
import type {CustomCreatorPart} from '../../types';
export interface PartMirrorProps {flipped?:Record<string,boolean>;onFlipPart?:(key:string)=>void;}
export function PartMirrorControls({category,selected,items=[],flipped={},onFlipPart}:PartMirrorProps&{category:string;selected:Record<string,string|string[]|null>;items?:CustomCreatorPart[]}){
 if(!onFlipPart||!selected[category])return null;
 const value=selected[category];
 const labels:Record<string,string>={fronthair:'前发',earhair:'耳发',back1:'后发 1',back2:'后发 2'};
 const choices=Array.isArray(value)?value.map(id=>({key:id,label:items.find(p=>p.id===id)?.name??'已选部件'})):[{key:category,label:labels[category]??'部件'}];
 return <div className="hair-buttons" aria-label="部件镜像">{choices.map(({key,label})=><button key={key} aria-label={`${label}镜像`} aria-pressed={!!flipped[key]} onClick={()=>onFlipPart(key)}><ArrowsLeftRight size={16}/>{label} · {flipped[key]?'已镜像':'镜像'}</button>)}</div>;
}
