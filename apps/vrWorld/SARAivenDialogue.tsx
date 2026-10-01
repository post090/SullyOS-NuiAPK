import React,{useState} from 'react';
import {X} from '@phosphor-icons/react';
import {SARDialogueCast} from './SARNpcArt';
import {SARDialogueChoices} from './SARDialogueChoices';
import type {AivenExpression} from '../../utils/vrWorld/sarArt';

const GUIDES:Record<string,{expression:AivenExpression;text:string}>={
    start:{expression:'normal',text:'这里的水很安静。你可以先钓一会儿。'},
    fishing:{expression:'interested',text:'鱼和漂来的东西都可以收起来。钓到橡皮泥恐龙的话，记得带给我看看。'},
    garden:{expression:'happy',text:'茶几上那块是恐龙箱庭。放好以后，还可以给它们换个颜色。'},
    rest:{expression:'sleeping',text:'……我坐一会儿。你随意。'},
};
export function SARAivenDialogue({onClose,onOpen}:{onClose:()=>void;onOpen:(entry:'water'|'garden')=>void}){
    const [topic,setTopic]=useState('start'),guide=GUIDES[topic];
    return <div className="sar-npc-dialogue fixed inset-0 z-[370] overflow-hidden bg-[#090a12]/78 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="与艾文交谈">
        <button type="button" onClick={onClose} aria-label="暂时离开对话" className="absolute right-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white/65" style={{top:'calc(var(--chrome-top) + .5rem)'}}><X size={17}/></button>
        <div className="sar-dialogue-portraits"><SARDialogueCast speaker="aiven" expression={guide.expression}/></div>
        <div className="sar-dialogue-panel"><div>
            <div className="px-5 pt-4 pb-4"><b className="text-[12px] tracking-[.18em] text-indigo-100">艾文</b><p className="mt-2 text-[15px] leading-7 text-white/90">{guide.text}</p></div>
        </div></div>
        <SARDialogueChoices key={topic}>
            {(topic==='fishing'||topic==='garden')&&<button type="button" onClick={()=>onOpen(topic==='fishing'?'water':'garden')}>{topic==='fishing'?'去钓鱼':'看看恐龙箱庭'}</button>}
            {topic==='start'?<>{[['fishing','聊聊钓鱼'],['garden','聊聊恐龙'],['rest','先坐一会儿']].map(([id,label])=><button key={id} type="button" onClick={()=>setTopic(id)}>{label}</button>)}</>:<button type="button" onClick={()=>setTopic('start')}>换个话题</button>}
            <button type="button" onClick={onClose}>先去逛逛</button>
        </SARDialogueChoices>
    </div>;
}
