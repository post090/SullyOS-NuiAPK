import React, { useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import type { FamiliaritySouvenir } from '../../utils/vrWorld/sarFamiliarity/storageTypes';
import { familiarityScene } from '../../utils/vrWorld/sarFamiliarity/catalog';
import { SARFamiliarityEffects } from './SARFamiliarityEffects';

export function SARFamiliarityKeepsake({ item, onClose, embedded=false }: { item:FamiliaritySouvenir; onClose:()=>void; embedded?:boolean }) {
    const [draft,setDraft]=useState({...item.draft,confirmed:true});
    const source=familiarityScene(item.sceneId)?.nodes[item.nodeId]?.effect;
    const effect=source||{kind:'memory-card' as const,title:item.title,text:item.description};
    return <div className={`sar-keepsake${embedded?' is-embedded':''}`} onKeyDown={event=>{
        if(event.key==='Escape'){event.stopPropagation();onClose();}
        if(event.key==='Tab'&&!embedded){
            const all=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'));
            if(event.shiftKey&&document.activeElement===all[0]){event.preventDefault();all.at(-1)?.focus();}
            else if(!event.shiftKey&&document.activeElement===all.at(-1)){event.preventDefault();all[0]?.focus();}
            event.stopPropagation();
        }
    }}>
        {!embedded&&<header><button type="button" autoFocus onClick={onClose} aria-label="收好纪念物"><ArrowLeft size={21}/></button><div><small>SAR · KEEPSAKES</small><h3>{item.title}</h3></div></header>}
        <main><SARFamiliarityEffects effect={effect} npc={item.npc} flags={item.flags} userName={item.userName} characters={[]} draft={draft} onDraftChange={value=>setDraft({...value,confirmed:true})} replay/>
            <p className="sar-keepsake-description">{item.description}</p><small className="sar-keepsake-date">{new Date(item.at).toLocaleDateString('zh-CN')} · {item.npc==='caian'?'凯恩':'艾文'}的回忆</small>
        </main>
    </div>;
}
