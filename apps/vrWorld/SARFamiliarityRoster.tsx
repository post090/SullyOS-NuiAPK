import React, { useEffect, useRef, useState } from 'react';
import { CaretDown, LockKey, Play, Star } from '@phosphor-icons/react';
import { FISHING_MARKET_STORAGE_KEY, readFishingMarketState } from '../../utils/vrWorld/fishingMarket';
import { CAIAN_SCENES } from '../../utils/vrWorld/sarFamiliarity/caian';
import { AIVEN_SCENES } from '../../utils/vrWorld/sarFamiliarity/aiven';
import { freshFamiliarity, type FamiliarityProgress, type FamiliarityState } from '../../utils/vrWorld/sarFamiliarity/storageTypes';
import type { FamiliarityNpc, FamiliarityScene } from '../../utils/vrWorld/sarFamiliarity/types';
import { canPreviewFamiliarityEvent, useSARExpressionReviewEnabled } from '../../utils/vrWorld/sarFamiliarity/devPreview';
import { SARPortrait } from './SARNpcArt';
import { readExpressionEdits, subscribeExpressionEdits, type ExpressionEdit } from '../../utils/vrWorld/sarFamiliarity/expressionReview';
import { SARExpressionExport } from './SARExpressionReview';
import './sar-familiarity-roster.css';

const PROFILES = {
    caian: { name: '凯恩', roman: 'Caian', number: '01', role: 'SAR 社长', occupation: '彼方兼职管理员',
        description: [
            '来自另一个世界的彼方玩家。和艾文一起取得了活动室的临时管理权限后，非常自然地把这里改造成了 SAR 的活动据点。',
            '看起来是精力过剩的热血社长，实际上是个重度游戏宅。喜欢游戏、动画、新技术和一切看起来“可以加个功能”的东西，最近正在兴致勃勃地研究彼方的人格推演与模块系统。',
            '似乎对人工人格与 AI 有一些不同寻常的执着。',
        ], quote: ['“闲置空间就是应该充分利用！所以我加个扭蛋机也很合理吧？”'] },
    aiven: { name: '艾文', roman: 'Aiven', number: '02', role: 'SAR 挂名成员', occupation: '彼方兼职管理员',
        description: [
            '和凯恩来自同一个世界。本人并没有多少经营活动室的热情，大部分时间都待在水边钓鱼。',
            '喜欢鱼和恐龙。掌握着大量不知道什么时候才会派上用场的鱼类与古生物知识。话很少，但并不难相处。就算没有话题，和他一起坐着似乎也没关系。',
            '最近钓上来的东西越来越不对劲。',
        ], quote: ['“刚才钓到一张角色卡。”', '“……字泡掉了。”'] },
} as const;
const SCENES = { caian: CAIAN_SCENES, aiven: AIVEN_SCENES };
const ranks = [1, 2, 3] as const;
const rankNames = ['一', '二', '三', '四', '五'];
const formatDate = (at: number) => new Date(at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });

function MemoryRow({ scene, progress, index, onOpen }: { scene: FamiliarityScene; progress: FamiliarityProgress; index: number; onOpen: () => void }) {
    const completed = progress.completed[scene.id], preview = !completed && canPreviewFamiliarityEvent(scene), available = !!completed || preview;
    const label = available ? scene.title : scene.kind === 'event' ? `${rankNames[scene.rank - 1]}星事件` : `${scene.kind === 'topic' ? '话题' : '彩蛋'} ${String(index + 1).padStart(2, '0')}`;
    return <button data-scene-id={scene.id} className={`sar-roster-memory ${available ? 'is-complete' : 'is-locked'}`} type="button" disabled={!available} onClick={onOpen} aria-label={available ? `回顾${scene.title}` : `${label} · 尚未解锁`}>
        <span className="sar-roster-memory-icon">{available ? <Play size={15} weight="fill"/> : <LockKey size={15}/>}</span>
        <span className="sar-roster-memory-title"><strong>{label}</strong><small>{completed ? `${formatDate(completed.at)} · 已收录` : preview ? '临时开放 · 测试回顾' : '尚未解锁'}</small></span>
        {scene.kind === 'event' && <span className="sar-roster-memory-rank">{'★'.repeat(scene.rank)}</span>}
    </button>;
}

export function SARFamiliarityRoster({ onOpenScene }: { onOpenScene: (npc: FamiliarityNpc, sceneId?: string) => void }) {
    const reviewEnabled=useSARExpressionReviewEnabled();
    const [npc, setNpc] = useState<FamiliarityNpc>('caian');
    const [tab, setTab] = useState<'profile' | 'memories'>('profile');
    const [state, setState] = useState<FamiliarityState>(() => freshFamiliarity());
    const [error, setError] = useState('');
    const [edits,setEdits]=useState<ExpressionEdit[]>([]),[reviewError,setReviewError]=useState('');
    const root = useRef<HTMLElement>(null);
    const scroll = useRef<HTMLElement>(null);
    useEffect(()=>{
        if(!reviewEnabled)return;
        const refresh=()=>{try{setEdits(readExpressionEdits());setReviewError('');}catch(e){setReviewError(e instanceof Error?e.message:'校对草稿无法读取');}};
        refresh();return subscribeExpressionEdits(refresh);
    },[reviewEnabled]);
    useEffect(() => {
        const refresh = () => { try { setState(readFishingMarketState().sarFamiliarity || freshFamiliarity()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '名册暂时无法读取'); } };
        const storage = (event: StorageEvent) => { if (!event.key || event.key === FISHING_MARKET_STORAGE_KEY) refresh(); };
        refresh(); window.addEventListener('vr-fishing-market-updated', refresh); window.addEventListener('storage', storage); window.addEventListener('focus', refresh);
        return () => { window.removeEventListener('vr-fishing-market-updated', refresh); window.removeEventListener('storage', storage); window.removeEventListener('focus', refresh); };
    }, []);
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [npc, tab]);
    const profile = PROFILES[npc], progress = state.npcs[npc], scenes = SCENES[npc];
    const completedCount = scenes.filter(scene => progress.completed[scene.id]).length;
    const events = scenes.filter(scene => scene.kind === 'event'), eggs = scenes.filter(scene => scene.kind === 'easter' || scene.kind === 'encounter');
    useEffect(() => {
        const target = window as Window & { render_game_to_text?: () => string };
        const render = () => JSON.stringify({ mode: 'sar-familiarity-roster', npc, tab, stars: progress.stars, completed: scenes.filter(scene => progress.completed[scene.id]).map(scene => scene.id), total: scenes.length, error });
        target.render_game_to_text = render;
        return () => { if (target.render_game_to_text === render) delete target.render_game_to_text; };
    }, [npc, tab, state, error]);
    const row = (scene: FamiliarityScene, index: number) => <MemoryRow key={scene.id} scene={scene} index={index} progress={progress} onOpen={() => { if (!error && (progress.completed[scene.id] || canPreviewFamiliarityEvent(scene))) onOpenScene(npc, scene.id); }}/>;
    return <section className="sar-familiarity-roster" ref={root}>
        <main className="sar-roster-scroll" ref={scroll}>
            <nav className="sar-roster-person-tabs" aria-label="选择名册角色">{(['caian', 'aiven'] as const).map(who => <button type="button" key={who} aria-pressed={npc === who} onClick={() => setNpc(who)}><small>{PROFILES[who].number}</small>{PROFILES[who].name}<span>{PROFILES[who].roman}</span></button>)}</nav>
            <div className={`sar-roster-hero is-${npc}`}>
                <div className="sar-roster-identity"><small>彼方常驻成员</small><h3>{profile.name}</h3><span className="sar-roster-roman">{profile.roman}</span><p>18 岁 · 大学一年级</p><p>{profile.role}<br/>{profile.occupation}</p></div>
                <div className="sar-roster-portrait"><SARPortrait who={npc} expression="normal"/></div>
                <div className="sar-roster-familiarity"><span>熟悉度</span><div className="sar-roster-stars" role="img" aria-label={`熟悉度 ${progress.stars} / 5 星`}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={19} weight={progress.stars >= star ? 'fill' : 'regular'} className={progress.stars >= star ? 'is-lit' : ''}/>)}</div><small>{completedCount} 段回忆</small></div>
            </div>
            <nav className="sar-roster-detail-tabs" aria-label="名册内容"><button type="button" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>人物档案</button><button type="button" aria-pressed={tab === 'memories'} onClick={() => setTab('memories')}>回忆 <span>{completedCount}</span></button></nav>
            {error ? <p role="alert" className="sar-roster-error">{error}</p> : tab === 'profile' ? <article className="sar-roster-biography" key={npc}>
                {profile.description.map(text => <p key={text}>{text}</p>)}
                <blockquote>{profile.quote.map(text => <p key={text}>{text}</p>)}</blockquote>
            </article> : <div className="sar-roster-memories" key={npc}>
                {reviewEnabled?<div className="sar-roster-review-note"><p>临时校对 · 两人全部话题、事件和彩蛋已开放。进入回顾后点「表情校对」逐句调整。</p><SARExpressionExport edits={edits}/>{reviewError&&<p role="alert">{reviewError}</p>}</div>:<p className="sar-roster-hint">相遇过的话题会留在这里，随时可以再看一遍。</p>}
                <section><h4>星级事件 <span>{events.filter(scene => progress.completed[scene.id]).length} / 3</span></h4>{events.map(row)}<div className="sar-roster-coming"><LockKey size={13}/><span>四星、五星故事尚未开放</span></div></section>
                <section><h4>日常话题</h4>{ranks.map(rank => { const topics = scenes.filter(scene => scene.kind === 'topic' && scene.rank === rank); return <details className="sar-roster-topic-group" key={rank} open={rank === Math.min(3, progress.stars + 1)}><summary tabIndex={0}><span>{rankNames[rank - 1]}星篇章</span><small>{topics.filter(scene => progress.completed[scene.id]).length} / {topics.length}</small><CaretDown size={14}/></summary>{topics.map(row)}</details>; })}</section>
                <section><h4>彩蛋与偶遇 <span>{eggs.filter(scene => progress.completed[scene.id]).length} / {eggs.length}</span></h4>{eggs.length ? eggs.map(row) : <p className="sar-roster-hint">暂时没有收录条目。</p>}</section>
            </div>}
        </main>
    </section>;
}
