import { sarGreetingExpression } from '../../utils/vrWorld/sarGreetingExpression';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { useOS } from '../../context/OSContext';
import { readFishingMarketState, type FishingMarketState } from '../../utils/vrWorld/fishingMarket';
import { familiarityScene, familiarityText, familiarityUserName } from '../../utils/vrWorld/sarFamiliarity/catalog';
import { advanceFamiliarity, deliverFamiliarityMessages, familiarityGreeting, familiarityProgress, saveFamiliarityDraft, startFamiliarity, visitFamiliarity } from '../../utils/vrWorld/sarFamiliarity/state';
import type { FamiliarityCursor } from '../../utils/vrWorld/sarFamiliarity/storageTypes';
import type { FamiliarityNpc } from '../../utils/vrWorld/sarFamiliarity/types';
import { SARDialogueCast } from './SARNpcArt';
import { SARDialogueProp } from './SARDialogueProp';
import { SARFamiliarityEffects } from './SARFamiliarityEffects';
import { SARDialogueChoices } from './SARDialogueChoices';
import { SARDialogueMeta } from './SARDialogueMeta';
import { SARDialogueBackdrop } from './SARDialogueBackdrop';
import { dialogueSentences, familiarityCast } from '../../utils/vrWorld/sarFamiliarity/dialogueText';
import { canPreviewFamiliarityEvent, useSARExpressionReviewEnabled } from '../../utils/vrWorld/sarFamiliarity/devPreview';
import { keepDialogueGuest } from '../../utils/vrWorld/sarDialogueStaging';
import { isSARActivityOccupant } from '../../utils/vrWorld/participation';
import { expressionOverrides, readExpressionEdits, subscribeExpressionEdits, type ExpressionEdit } from '../../utils/vrWorld/sarFamiliarity/expressionReview';
import { SARExpressionReview } from './SARExpressionReview';
import './sar-familiarity-dialog.css';

export function SARFamiliarityDialog({ npc, sceneId, onClose, onEditUserChibi, onSellFish }: {
    npc: FamiliarityNpc; sceneId?: string; onClose: () => void; onEditUserChibi: () => void; onSellFish?: () => void;
}) {
    const reviewEnabled=useSARExpressionReviewEnabled();
    const { userProfile, characters } = useOS();
    const [market,setMarket]=useState<FishingMarketState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
    const [replay,setReplay]=useState<FamiliarityCursor|null>(null),[finished,setFinished]=useState(false),[draft,setDraft]=useState<Record<string,unknown>>({});
    const [page,setPage]=useState({key:'',index:0});
    const [dismissedProp,setDismissedProp]=useState('');
    const [preview,setPreview]=useState(false);
    const [serviceText,setServiceText]=useState<string|null>(null);
    const canSellFish=npc==='aiven'&&!sceneId&&!!onSellFish;
    const [reviewOpen,setReviewOpen]=useState(false),[edits,setEdits]=useState<ExpressionEdit[]>([]),[reviewError,setReviewError]=useState('');
    const reviewHistory=useRef<Array<{cursor:FamiliarityCursor;sentence:number;draft:Record<string,unknown>;dismissedProp:string;choice?:boolean}>>([]);
    const root=useRef<HTMLElement>(null),lock=useRef(false),mounted=useRef(true),opened=useRef(false);
    const draftTimer=useRef<ReturnType<typeof setTimeout>|null>(null),draftWrite=useRef<{cursor:FamiliarityCursor;draft:Record<string,unknown>}|null>(null);
    const flushDraft=()=>{
        if(draftTimer.current)clearTimeout(draftTimer.current);draftTimer.current=null;
        const pending=draftWrite.current;draftWrite.current=null;
        if(pending)void saveFamiliarityDraft(npc,pending.cursor,pending.draft).catch(cause=>{if(mounted.current)setError((cause as Error).message);});
    };
    const userName=familiarityUserName(userProfile?.name),sully=characters.find(c=>c.id==='preset-sully-v2')||characters.find(c=>c.name.trim().toLowerCase()==='sully');
    const options={userName,sullyId:sully?.id,sullyInSar:!!sully&&isSARActivityOccupant(sully),legacyTitles:!!(userProfile?.vrState?.title||characters.some(c=>c.vrState?.title))};
    const progress=market?familiarityProgress(market,npc):undefined;
    const [endingCursor,setEndingCursor]=useState<FamiliarityCursor|null>(null);
    const cursor=endingCursor||(sceneId?replay:progress?.pending);
    const scene=cursor?familiarityScene(cursor.sceneId):undefined,node=scene&&cursor?scene.nodes[cursor.nodeId]:undefined;
    const line=node?.lines[cursor?.line||0],lastLine=!!node&&(!node.lines.length||(cursor?.line||0)>=node.lines.length-1);
    const name=npc==='caian'?'凯恩':'艾文';
    const run=async(action:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'没有保存成功，请重试');}finally{lock.current=false;if(mounted.current)setBusy(false);}};
    const open=async()=>{
        if(sceneId){
            const current=readFishingMarketState(),past=familiarityProgress(current,npc).completed[sceneId],s=familiarityScene(sceneId);
            if(!s||s.npc!==npc||(!past&&!canPreviewFamiliarityEvent(s)))throw new Error('这段回忆还没有解锁');
            setPreview(!past);setMarket(current);setReplay({runId:'replay',sceneId,nodeId:s.start,line:0,revision:0,startedAt:past?.at||Date.now(),flags:{...past?.flags},drafts:{},userName});opened.current=true;return;
        }
        let current=await visitFamiliarity(npc,options);
        const offer=current.sarFamiliarity?.npcs[npc].offerId;
        if(offer)current=await startFamiliarity(npc,offer,options);
        if(mounted.current){setMarket(current);opened.current=true;}
        void deliverFamiliarityMessages().catch(()=>{if(mounted.current)setError('回忆已保存，私聊彩蛋待下次打开时重试');});
    };
    useEffect(()=>{
        if(!reviewEnabled||!sceneId)return;
        const refresh=()=>{try{setEdits(readExpressionEdits());setReviewError('');}catch(e){setReviewError(e instanceof Error?e.message:'校对草稿无法读取');}};
        refresh();return subscribeExpressionEdits(refresh);
    },[sceneId,reviewEnabled]);
    useEffect(()=>{
        mounted.current=true;opened.current=false;const prior=document.activeElement as HTMLElement|null;
        (root.current?.querySelector<HTMLButtonElement>('.srf-close')||root.current)?.focus();void run(open);
        // Opening prepares commerce and resets interrupted progress in separate transactions.
        // Do not paint an intermediate snapshot containing the previous conversation's cast.
        const refresh=()=>{if(!opened.current)return;try{setMarket(readFishingMarketState());}catch(cause){setError((cause as Error).message);}};
        window.addEventListener('vr-fishing-market-updated',refresh);window.addEventListener('storage',refresh);
        return()=>{flushDraft();mounted.current=false;window.removeEventListener('vr-fishing-market-updated',refresh);window.removeEventListener('storage',refresh);prior?.focus();};
    },[npc,sceneId]);
    useEffect(()=>{
        if(!cursor)return;
        const saved=sceneId?market?.sarFamiliarity?.souvenirs.find(s=>s.sceneId===sceneId&&s.nodeId===cursor.nodeId)?.draft:undefined;
        setDraft({...cursor.drafts[cursor.nodeId]||saved||{date:new Date(sceneId?cursor.startedAt:Date.now()).toLocaleDateString('zh-CN')},...(sceneId&&!preview?{confirmed:true}:{})});
    },[cursor?.runId,cursor?.nodeId,preview]);
    useEffect(()=>{if(preview&&!reviewEnabled)onClose();if(!reviewEnabled)setReviewOpen(false);},[preview,reviewEnabled]);
    const changeDraft=(value:Record<string,unknown>)=>{
        setDraft(value);
        if(node?.effect?.kind==='mystery-button'&&value.mysteryPressed&&!draft.mysteryPressed){advance(undefined,value);return;}
        if(cursor&&!sceneId){
            draftWrite.current={cursor,draft:value};
            if(draftTimer.current)clearTimeout(draftTimer.current);
            draftTimer.current=setTimeout(flushDraft,120);
        }
    };
    const advance=(choice?:number,committedDraft=draft)=>void run(async()=>{
        if(!cursor||!node||!scene)return;
        rememberReview(choice!==undefined&&!!node.choices?.[choice]);
        // The advance transaction includes the latest draft, so a drag never queues dozens of full saves.
        if(draftTimer.current)clearTimeout(draftTimer.current);draftTimer.current=null;draftWrite.current=null;
        if(sceneId){
            const spoken=node.lines[cursor.line];
            const updated={...cursor,guestPresent:keepGuest,cast:cast,speaker:spoken?.speaker==='caian'||spoken?.speaker==='aiven'?spoken.speaker:cursor.speaker};
            if(cursor.line<node.lines.length-1){setReplay({...updated,line:cursor.line+1,revision:cursor.revision+1});return;}
            const selected=choice===undefined?undefined:node.choices?.[choice];
            if(node.choices?.length&&!selected)return;
            const next=selected?.next||node.next;
            if(next)setReplay({...updated,nodeId:next,line:0,revision:cursor.revision+1,flags:{...cursor.flags,...selected?.flags},drafts:{...cursor.drafts,[cursor.nodeId]:committedDraft}});
            else if(reviewEnabled||scene.kind==='event'){setReplay(updated);setFinished(true);setReviewOpen(false);}
            else{setReplay(null);setFinished(true);onClose();}return;
        }
        const next=await advanceFamiliarity(npc,cursor,{choice,draft:committedDraft});setMarket(next);
        if(!next.sarFamiliarity?.npcs[npc].pending){setFinished(true);if(scene.kind==='event'||canSellFish)setEndingCursor({...cursor,cast});if(scene.kind!=='event'){if(canSellFish)setServiceText(text);else onClose();}}
        void deliverFamiliarityMessages().catch(()=>setError('回忆已保存，私聊彩蛋待重试'));
    });
    // Props belong to one authored reveal, never the entire conversation branch.
    const propKey=`${cursor?.runId}:${cursor?.sceneId}:${cursor?.nodeId}`;
    const visual=!finished&&node?.effect&&(node.effect.kind==='confetti'||(cursor?.line||0)===(node.effectLine||0))&&dismissedProp!==propKey?node.effect:undefined;
    // Freeze greetings for this visit; storage refreshes must not replace a sentence mid-read.
    const greetings=useMemo(()=>market?familiarityGreeting(npc,market):[],[npc,market?.seed,!!node,finished]);
    const sentences=finished&&scene?.kind==='event'?[`结束${scene.rank}星事件：${scene.title}`]:sceneId&&finished?['这条分支看完了，可以返回选项，再试另一种回应。']:node?(line?dialogueSentences(line.text).map(sentence=>familiarityText(sentence,cursor?.userName||userName,cursor?.flags)):[node.effect?.title||' '])
        :greetings.flatMap(dialogueSentences);
    const pageKey=`${npc}:${sceneId||''}:${cursor?.runId||'greeting'}:${cursor?.nodeId||''}:${cursor?.line||0}:${finished}`;
    const pageIndex=page.key===pageKey?Math.min(page.index,Math.max(0,sentences.length-1)):0;
    const lastSentence=pageIndex>=sentences.length-1;
    const waitingForEffect=!!node&&(!sceneId||preview)&&!!visual?.interactive&&!draft.confirmed;
    const showChoices=!finished&&!!market&&lastSentence&&!visual&&!waitingForEffect&&!!node&&lastLine&&!!node.choices?.length;
    const text=serviceText??(sentences[pageIndex]||(market?' ':'正在走进活动室…'));
    const continueDialogue=()=>{
        if(busy||showChoices||serviceText!==null)return;
        if(finished){if(canSellFish)setServiceText(text);else onClose();return;}
        if(!lastSentence){rememberReview();setPage({key:pageKey,index:pageIndex+1});}
        else if(visual&&lastLine&&node?.choices?.length&&!waitingForEffect){rememberReview();setDismissedProp(propKey);}
        else if(node&&!waitingForEffect)advance();
        else if(!node){if(canSellFish)setServiceText(text);else onClose();}
    };
    const nextHint=serviceText!==null?'请选择回应':busy?'保存中…':finished?(sceneId?'点击返回名册':canSellFish?'点击继续':'点击返回活动室'):waitingForEffect&&lastSentence?'先完成上方操作':node&&lastLine&&lastSentence&&!node.next&&!node.choices?.length?'点击收好这段回忆':visual&&visual.kind!=='confetti'&&lastSentence?'点击收起，继续对话':'点击继续';
    useEffect(()=>{
        const target=window as Window&{render_game_to_text?:()=>string;advanceTime?:(ms:number)=>void};
        const render=()=>JSON.stringify({mode:'sar-familiarity',npc,replay:!!sceneId,preview,stars:progress?.stars,scene:scene?.id,node:cursor?.nodeId,line:cursor?.line,sentence:pageIndex,text,choices:serviceText!==null?['卖鱼','离开']:showChoices?node?.choices?.map(c=>familiarityText(c.label,userName,cursor?.flags)):[],effect:visual?.kind,confirmed:!!draft.confirmed,busy,error,finished,...(reviewEnabled&&sceneId?{reviewOpen,expressionEdits:edits.length,expressions:cast}:{})});
        target.render_game_to_text=render;return()=>{if(target.render_game_to_text===render)delete target.render_game_to_text;};
    },[npc,sceneId,progress?.stars,scene,cursor,pageIndex,text,showChoices,node,draft,busy,error,finished,visual,userName,preview,edits,reviewOpen,serviceText]);
    const keepGuest=!!scene&&!!cursor&&keepDialogueGuest(scene.nodes,cursor.nodeId,cursor.line,npc,cursor.guestPresent??!!cursor.cast?.[npc==='caian'?'aiven':'caian']);
    const castSpeaker=line?.speaker==='caian'||line?.speaker==='aiven'?line.speaker:keepGuest?cursor?.speaker||npc:npc;
    const originalCast=finished?cursor?.cast||{}:familiarityCast(cursor?.cast,line,pageIndex);
    const overrides=reviewEnabled&&sceneId&&scene&&cursor?expressionOverrides(edits,scene.id,cursor.nodeId,cursor.line,pageIndex):{};
    const cast={...originalCast,...(line?.speaker==='caian'||line?.speaker==='aiven'?{[line.speaker]:overrides[line.speaker]||originalCast[line.speaker]}:{})};
    const expression=cast[castSpeaker]||'normal';
    function rememberReview(choice=false){
        if(reviewEnabled&&sceneId&&cursor){reviewHistory.current.push({cursor:structuredClone(cursor),sentence:pageIndex,draft:structuredClone(draft),dismissedProp,choice});if(reviewHistory.current.length>500)reviewHistory.current.shift();}
    }
    const restoreReview=(index:number)=>{
        if(busy||lock.current||index<0)return;
        const prior=reviewHistory.current[index];if(!prior)return;
        reviewHistory.current.splice(index);setFinished(false);setEndingCursor(null);
        setReplay({...prior.cursor,drafts:{...prior.cursor.drafts,[prior.cursor.nodeId]:prior.draft}});setPage({key:`${npc}:${sceneId}:${prior.cursor.runId}:${prior.cursor.nodeId}:${prior.cursor.line}:false`,index:prior.sentence});setDismissedProp(prior.dismissedProp);setDraft(prior.draft);
    };
    const reviewBack=()=>restoreReview(reviewHistory.current.length-1);
    const lastChoiceIndex=reviewHistory.current.map((step,i)=>step.choice?i:-1).filter(i=>i>=0).at(-1)??-1;
    const returnToChoice=()=>restoreReview(lastChoiceIndex>=0?lastChoiceIndex:reviewHistory.current.length-1);
    const reviewJump=(nodeId:string,lineIndex:number,sentence:number)=>{
        if(!reviewEnabled||!sceneId||!scene||!cursor||busy||!scene.nodes[nodeId]?.lines[lineIndex])return;
        rememberReview();
        // Derive one authored path for branch context. This stays entirely inside replay memory.
        const queue=[{id:scene.start,path:[] as string[],flags:{} as FamiliarityCursor['flags']}],seen=new Set<string>();
        let route=queue[0];
        while(queue.length){const candidate=queue.shift()!;if(seen.has(candidate.id))continue;seen.add(candidate.id);if(candidate.id===nodeId){route=candidate;break;}const entry=scene.nodes[candidate.id];for(const edge of entry.choices||[...(entry.next?[{next:entry.next,flags:{}}]:[])])queue.push({id:edge.next,path:[...candidate.path,candidate.id],flags:{...candidate.flags,...edge.flags}});}
        let restoredCast:FamiliarityCursor['cast']={},restoredSpeaker:FamiliarityNpc=npc,guest=false;
        for(const id of [...route.path,nodeId]){
            const lines=scene.nodes[id].lines;const end=id===nodeId?lineIndex:lines.length;
            for(let i=0;i<end;i++){const spoken=lines[i];guest=keepDialogueGuest(scene.nodes,id,i,npc,guest);restoredCast=familiarityCast(restoredCast,spoken);if(spoken.speaker==='caian'||spoken.speaker==='aiven'){const editsForLine=expressionOverrides(edits,scene.id,id,i,dialogueSentences(spoken.text).length-1);if(editsForLine[spoken.speaker])restoredCast[spoken.speaker]=editsForLine[spoken.speaker] as never;restoredSpeaker=spoken.speaker;}}
        }
        setReplay({...cursor,nodeId,line:lineIndex,revision:cursor.revision+1,flags:route.flags,cast:restoredCast,speaker:restoredSpeaker,guestPresent:guest});
        setPage({key:`${npc}:${sceneId}:${cursor.runId}:${nodeId}:${lineIndex}:false`,index:sentence});setDismissedProp('');
    };
    const keyDown=(e:React.KeyboardEvent)=>{
        if(e.key==='Escape'){e.stopPropagation();onClose();}
        if(e.key!=='Tab')return;
        const focus=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,textarea,summary,[tabindex="0"]')||[]),first=focus[0],last=focus.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    };
    return <section ref={root} tabIndex={-1} className={`srf-dialog srf-${npc} ${visual?'has-effect':''} ${reviewOpen?'is-reviewing':''}`} role="dialog" aria-modal="true" aria-label={`${name}${sceneId?'的回忆':'的日常'}`} onKeyDown={keyDown}>
        <SARDialogueBackdrop/>
        <div className="srf-body">
            <div className={`srf-stage ${visual?'with-effect':''}`}>
                <SARDialogueCast lead={npc} speaker={castSpeaker} expression={scene?expression:finished?'happy':sentences.slice(0,pageIndex+1).reduce<ReturnType<typeof sarGreetingExpression>|undefined>((previous,sentence,index)=>sarGreetingExpression(npc,sentence,index,previous),undefined)} castExpressions={cast} keepGuest={keepGuest}/>
                {visual&&<SARDialogueProp key={propKey} kind={visual.kind} interactive={visual.interactive}>
                        <SARFamiliarityEffects key={propKey} inScene effect={visual} npc={npc} flags={cursor?.flags||{}} userName={cursor?.userName||userName} userChibi={userProfile?.vrState?.chibi?.img}
                            characters={characters.map(c=>({id:c.id,name:c.name,chibi:c.vrState?.chibi?.img}))} draft={draft} onDraftChange={changeDraft} onEditUserChibi={onEditUserChibi} replay={!!sceneId&&!preview}/>
                </SARDialogueProp>}
            </div>
            <div className="srf-script">
                <SARDialogueMeta npc={npc} speaker={line?.speaker==='narrator'?'旁白':line?.speaker==='sully'?'Sully':line?.speaker==='caian'?'凯恩':line?.speaker==='aiven'?'艾文':name}
                    stars={progress?.stars||0} replayTitle={sceneId?scene?.title:undefined} onClose={sceneId?onClose:undefined}/>
                <button className="srf-bubble" type="button" aria-label="继续对话" disabled={busy||!market||showChoices||serviceText!==null||(lastSentence&&waitingForEffect)} onClick={continueDialogue}>
                    <span className={`srf-line ${finished&&scene?.kind==='event'?'srf-collected srf-endpage':line?.speaker==='narrator'?'is-narration':''}`} role={finished?'status':undefined}>{text}</span>
                    <span className="srf-next">{showChoices?(reviewOpen?'在校对栏选择回应':'请选择回应'):nextHint}<ArrowRight size={16}/></span>
                </button>
                {error&&<p className="srf-error" role="alert">{error}{!market&&<button disabled={busy} onClick={()=>void run(open)}>重新打开</button>}</p>}
            </div>
        </div>
        {serviceText!==null&&canSellFish&&<SARDialogueChoices><button type="button" onClick={onSellFish}>卖鱼</button><button type="button" onClick={onClose}>离开</button></SARDialogueChoices>}
        {showChoices&&!reviewOpen&&<SARDialogueChoices key={pageKey}>
            {node?.choices?.map((choice,i)=><button type="button" key={i} disabled={busy} onClick={()=>advance(i)}>{familiarityText(choice.label,userName,cursor?.flags)}</button>)}
        </SARDialogueChoices>}
        {reviewEnabled&&sceneId&&scene&&cursor&&<button className="sar-review-toggle sar-review-back" type="button" disabled={!reviewHistory.current.length||busy} onClick={returnToChoice}><ArrowLeft size={14}/>{lastChoiceIndex>=0?'返回选项':'返回上一步'}</button>}
        {reviewEnabled&&sceneId&&scene&&cursor&&!finished&&(reviewOpen?<SARExpressionReview scene={scene} nodeId={cursor.nodeId} lineIndex={cursor.line} sentence={pageIndex} text={text} speaker={castSpeaker} cast={cast} originalCast={originalCast} edits={edits} canBack={!!reviewHistory.current.length&&!busy} onBack={reviewBack} onJump={reviewJump} onClose={()=>setReviewOpen(false)} choices={showChoices?node?.choices?.map((choice,i)=>({label:familiarityText(choice.label,userName,cursor.flags),onSelect:()=>advance(i)})):undefined}/>:<button className="sar-review-toggle" type="button" aria-label="打开表情校对" onClick={()=>setReviewOpen(true)}>表情校对{edits.length?` · ${edits.length}`:''}</button>)}
        {reviewOpen&&reviewError&&<p className="srf-error" role="alert">{reviewError}</p>}
    </section>;
}
