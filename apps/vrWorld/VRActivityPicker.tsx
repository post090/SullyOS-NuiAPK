import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CaretRight, X } from '@phosphor-icons/react';
import { useOS } from '../../context/OSContext';
import type { CharacterProfile, VRRoomId, VRSARActivity, VRWorldCharState } from '../../types';
import { ORDINARY_ACTIVITIES, SAR_ACTIVITIES } from '../../utils/vrWorld/activityChoices';
import './vr-activity-picker.css';

export function VRActivityPicker({char,libraryAvailable,gardenReason,onGo,onClose}:{
    char:CharacterProfile; libraryAvailable:boolean; gardenReason?:string;
    onGo:(room?:VRRoomId,activity?:VRSARActivity)=>void; onClose:()=>void;
}) {
    const [group,setGroup]=useState<'ordinary'|'sar'|null>(null);
    const panel=useRef<HTMLElement>(null), {registerBackHandler}=useOS();
    const back=()=>group?setGroup(null):onClose();
    const latestBack=useRef(back);latestBack.current=back;
    useEffect(()=>registerBackHandler(()=>{latestBack.current();return true;}),[registerBackHandler]);
    useEffect(()=>{
        const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();latestBack.current();}};
        window.addEventListener('keydown',escape,true);
        return ()=>window.removeEventListener('keydown',escape,true);
    },[]);
    useEffect(()=>{panel.current?.querySelector<HTMLButtonElement>('header button')?.focus();},[group]);
    useEffect(()=>{
        const previous=document.activeElement;
        panel.current?.querySelector<HTMLButtonElement>('header button')?.focus();
        return ()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
    },[]);
    return <div className="vra-backdrop" onClick={onClose} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();back();}}}>
        <section ref={panel} className="vra-picker" role="dialog" aria-modal="true" aria-label={`邀请${char.name}活动`} onClick={e=>e.stopPropagation()} onKeyDown={e=>{
            if(e.key!=='Tab')return;
            const elements=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)')||[]);
            if(document.activeElement===(e.shiftKey?elements[0]:elements.at(-1))){e.preventDefault();(e.shiftKey?elements.at(-1):elements[0])?.focus();}
        }}>
            <header><button aria-label={group?'返回活动分类':'关闭活动选择'} onClick={back}>{group?<ArrowLeft size={20}/>:<X size={20}/>}</button><div><small>KANATA · INVITATION</small><h2>{group==='ordinary'?'普通空间':group==='sar'?'SAR 活动室':`让 ${char.name} 去哪里？`}</h2></div></header>
            <main>{!group?<>
                <button className="vra-group" onClick={()=>setGroup('ordinary')}><span><b>普通空间</b><small>读书、听歌、版聊、写信……</small></span><CaretRight size={18}/></button>
                <button className="vra-group" onClick={()=>setGroup('sar')}><span><b>SAR 活动室</b><small>芯片、模块、钓鱼、布告板、箱庭</small></span><CaretRight size={18}/></button>
            </>:group==='ordinary'?ORDINARY_ACTIVITIES.map(a=><button className="vra-choice" key={a.id} disabled={a.id==='library'&&!libraryAvailable} onClick={()=>onGo(a.id)}><span><b>{a.name}</b><small>{a.id==='library'&&!libraryAvailable?'阅读范围内还没有书':a.description}</small></span><CaretRight size={15}/></button>):SAR_ACTIVITIES.map(a=><button className="vra-choice" key={a.id} disabled={a.id==='garden'&&!!gardenReason} onClick={()=>onGo('sar',a.id)}><span><b>{a.name}</b><small>{a.id==='garden'&&gardenReason?gardenReason:a.description}</small></span><CaretRight size={15}/></button>)}</main>
            <footer><p>手动邀请可前往高级选项中限制的地方。</p>{!group?<button onClick={()=>onGo()}>随便逛逛</button>:group==='sar'?<button onClick={()=>onGo('sar')}>在活动室随便玩一样</button>:null}</footer>
        </section>
    </div>;
}

export function VRActivityRestrictions({char,onChange}:{char:CharacterProfile;onChange:(update:(state:VRWorldCharState)=>VRWorldCharState)=>void}) {
    const rooms=char.vrState?.excludedAutoRooms||[], sar=char.vrState?.excludedAutoSARActivities||[];
    const sarBlocked=rooms.includes('sar');
    const count=ORDINARY_ACTIVITIES.filter(a=>rooms.includes(a.id)).length+(sarBlocked?SAR_ACTIVITIES.length:SAR_ACTIVITIES.filter(a=>sar.includes(a.id)).length);
    return <details className="vra-restrictions"><summary>高级选项 <span>{count?`${count} 项不自动前往`:'自由活动范围'}</span></summary>
        <p>勾选不希望 ta 自动去的地方。仅限制自动活动，手动邀请仍然有效；正在进行的一轮可以完成。</p>
        <fieldset><legend>普通空间</legend>{ORDINARY_ACTIVITIES.map(a=><label key={a.id}><input type="checkbox" aria-label={`不自动去${a.name}`} checked={rooms.includes(a.id)} onChange={()=>onChange(s=>({...s,excludedAutoRooms:toggle(s.excludedAutoRooms,a.id)}))}/><span>{a.name}</span></label>)}</fieldset>
        <fieldset><legend>SAR 活动室</legend><label className="vra-whole"><input type="checkbox" aria-label="不自动去整个SAR活动室" checked={sarBlocked} onChange={()=>onChange(s=>({...s,excludedAutoRooms:toggle(s.excludedAutoRooms,'sar')}))}/><span>整个活动室都不去</span></label>{SAR_ACTIVITIES.map(a=><label key={a.id} className={sarBlocked?'is-inherited':''}><input type="checkbox" aria-label={`不自动玩${a.name}`} checked={sarBlocked||sar.includes(a.id)} disabled={sarBlocked} onChange={()=>onChange(s=>({...s,excludedAutoSARActivities:toggle(s.excludedAutoSARActivities,a.id)}))}/><span>{a.name}</span></label>)}</fieldset>
        {count===ORDINARY_ACTIVITIES.length+SAR_ACTIVITIES.length&&<p role="status">全部自动活动已排除；到点会跳过，不调用模型。你仍可手动邀请。</p>}
        <button type="button" disabled={!count} onClick={()=>onChange(s=>({...s,excludedAutoRooms:[],excludedAutoSARActivities:[]}))}>恢复全部可去</button>
    </details>;
}

function toggle<T extends string>(values:T[]|undefined,id:T):T[]{return values?.includes(id)?values.filter(x=>x!==id):[...(values||[]),id];}
