import React, { useEffect, useMemo, useState } from 'react';
import { Copy, DownloadSimple, X, ArrowLeft, ArrowCounterClockwise } from '@phosphor-icons/react';
import { SAR_EXPRESSIONS, SAR_NPC_NAMES, type SARCastExpressions, type SARExpression } from '../../utils/vrWorld/sarArt';
import { dialogueSentences } from '../../utils/vrWorld/sarFamiliarity/dialogueText';
import type { FamiliarityNpc, FamiliarityScene } from '../../utils/vrWorld/sarFamiliarity/types';
import { exportExpressionEdits, resetExpressionEdit, writeExpressionEdit, type ExpressionEdit } from '../../utils/vrWorld/sarFamiliarity/expressionReview';
import { SARPortrait } from './SARNpcArt';
import './sar-expression-review.css';

const LABELS: Record<SARExpression,string> = {normal:'平常',happy:'开心',curious:'好奇',embarrassed:'尴尬',serious:'认真',shy:'害羞',aboutaster:'回忆 Aster','Enduring Pain':'忍痛',avoidant:'回避',normal2:'平常 2',warm:'温柔',interested:'感兴趣',sad:'低落',sleeping:'困倦'};

export function SARExpressionExport({edits}:{edits:ExpressionEdit[]}) {
    const [message,setMessage]=useState(''),[manual,setManual]=useState(false);
    const serialized=useMemo(()=>exportExpressionEdits(edits),[edits]);
    useEffect(()=>setMessage(''),[serialized]);
    const copy=async()=>{try{await navigator.clipboard.writeText(serialized);setMessage('已复制，可以直接发给我');setManual(false);}catch{setManual(true);setMessage('请复制下方清单，或下载文件');}};
    const download=()=>{
        const url=URL.createObjectURL(new Blob([serialized],{type:'application/json;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download='SAR-两人表情修改.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已下载，改完把 JSON 文件发给我');
    };
    return <div className="sar-expression-export">
        <span>两人共 <b>{edits.length}</b> 处修改</span>
        <div><button type="button" onClick={()=>void copy()}><Copy size={15}/>复制修改清单</button><button type="button" onClick={download}><DownloadSimple size={15}/>下载修改清单</button></div>
        {message&&<small role="status">{message}</small>}
        {manual&&<textarea aria-label="表情修改清单" readOnly value={serialized} onFocus={e=>e.currentTarget.select()}/>}
    </div>;
}

export function SARExpressionReview({scene,nodeId,lineIndex,sentence,text,speaker,cast,originalCast,edits,canBack,onBack,onJump,onClose,choices}:{
    scene:FamiliarityScene;nodeId:string;lineIndex:number;sentence:number;text:string;speaker:FamiliarityNpc;
    cast:Partial<SARCastExpressions>;originalCast:Partial<SARCastExpressions>;edits:ExpressionEdit[];canBack:boolean;
    onBack:()=>void;onJump:(nodeId:string,line:number,sentence:number)=>void;onClose:()=>void;
    choices?:Array<{label:string;onSelect:()=>void}>;
}) {
    const [target,setTarget]=useState<FamiliarityNpc>(speaker),[error,setError]=useState('');
    useEffect(()=>{setTarget(speaker);setError('');},[scene.id,nodeId,lineIndex,sentence,speaker]);
    const options=useMemo(()=>Object.entries(scene.nodes).flatMap(([id,node])=>node.lines.flatMap((line,i)=>dialogueSentences(line.text).map((sentence,j)=>({key:`${id}:${i}:${j}`,node:id,line:i,sentence:j,label:`${line.speaker==='caian'?'凯恩':line.speaker==='aiven'?'艾文':line.speaker==='sully'?'Sully':'旁白'} · ${sentence}`})))),[scene]);
    const address={sceneId:scene.id,nodeId,line:lineIndex,sentence,npc:target};
    const changed=edits.some(e=>e.sceneId===scene.id&&e.nodeId===nodeId&&e.line===lineIndex&&e.sentence===sentence&&e.npc===target);
    const selected=cast[target]||'normal',original=originalCast[target]||'normal';
    const hasLine=!!scene.nodes[nodeId]?.lines[lineIndex];
    const canEdit=scene.nodes[nodeId]?.lines[lineIndex]?.speaker===target;
    const change=(expression:SARExpression)=>{try{writeExpressionEdit(address,original,expression);setError('');}catch(e){setError(e instanceof Error?e.message:'修改没有保存，请重试');}};
    const reset=()=>{try{resetExpressionEdit(address);setError('');}catch(e){setError(e instanceof Error?e.message:'恢复失败，请重试');}};
    return <aside className="sar-expression-review" aria-label="表情校对" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}>
        <header><div><small>临时校对</small><strong>这一句的表情</strong></div><button type="button" onClick={onClose} aria-label="收起表情校对"><X size={19}/></button></header>
        <div className="sar-expression-review-scroll">
            <div className="sar-expression-navigation"><button type="button" onClick={onBack} disabled={!canBack}><ArrowLeft size={15}/>上一句</button><select aria-label="跳转台词" value={hasLine?`${nodeId}:${lineIndex}:${sentence}`:''} onChange={e=>{const value=options.find(o=>o.key===e.target.value);if(value)onJump(value.node,value.line,value.sentence);}}><option value="" disabled>选择台词或分支</option>{options.map((o,i)=><option key={o.key} value={o.key}>{i+1}. {o.label}</option>)}</select></div>
            <p className="sar-expression-current">{text}</p>
            <small className="sar-expression-address">{scene.id} / {nodeId} · 第 {lineIndex+1} 行，第 {sentence+1} 句</small>
            <nav aria-label="校对角色">{(['caian','aiven'] as const).map(npc=><button type="button" key={npc} aria-label={`校对${SAR_NPC_NAMES[npc]}`} aria-pressed={target===npc} onClick={()=>setTarget(npc)}>{SAR_NPC_NAMES[npc]}</button>)}</nav>
            {!canEdit&&<small>此时沿用上次发言的表情，请跳到该角色的台词修改。</small>}
            <div className="sar-expression-options">{SAR_EXPRESSIONS[target].map(expression=><button key={expression} type="button" aria-label={`表情：${expression}`} aria-pressed={selected===expression} disabled={!canEdit} onClick={()=>change(expression)}><div><SARPortrait who={target} expression={expression}/></div><span>{LABELS[expression]}</span><small>{expression}</small></button>)}</div>
            <div className="sar-expression-reset"><small>{changed?'这句已修改':'当前：'+LABELS[selected]}</small><button type="button" disabled={!changed} onClick={reset}><ArrowCounterClockwise size={14}/>恢复这句原表情</button></div>
            {!hasLine&&<small>此处只有演出，请跳到一句台词再修改。</small>}
            {error&&<p className="sar-expression-error" role="alert">{error}</p>}
            {!!choices?.length&&<details className="sar-expression-choices"><summary>选择回应 · {choices.length}</summary><div role="group" aria-label="校对中选择回应">{choices.map((choice,i)=><button type="button" key={i} onClick={choice.onSelect}>{choice.label}</button>)}</div></details>}
            <SARExpressionExport edits={edits}/>
            <p className="sar-expression-footnote">自动保存在此浏览器。修改只作用于校对回顾，导出包含两人的全部修改。</p>
        </div>
    </aside>;
}
