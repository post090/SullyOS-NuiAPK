import React, { useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, EnvelopeOpen, PaperPlaneTilt, PencilSimpleLine, SlidersHorizontal, Suitcase } from '@phosphor-icons/react';
import { AppID } from '../types';
import { useOS } from '../context/OSContext';
import { useLocalBackHandler } from '../hooks/useLocalBackHandler';
import { createLocalId } from '../utils/localId';
import { trackVoyageResult } from '../utils/voyage/analytics';
import { listInvitations, sendInvitation } from '../utils/voyage/invitations';
import { INVITATIONS_CHANGED, invitationStatus, invitationTitle, type InvitationOccasion, type TravelInvitation } from '../utils/voyage/letter';
import { requestInvitationReply } from '../utils/voyage/reply';
import TokenImg from '../components/os/TokenImg';
import VoyagePlanning from './VoyagePlanning';
import { VoyageCharacterSettings } from './VoyageContextFields';
import { useAppShortcut } from '../utils/appShortcutLaunch';
import './voyage.css';

type Page = 'list' | 'compose' | 'letter' | 'planning' | 'context';
const sentDate = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

export default function VoyageApp() {
    const { characters, worldbooks, theme, userProfile, apiConfig, activeCharacterId, setActiveCharacterId, openApp, closeApp } = useOS();
    const [page, setPage] = useState<Page>('list');
    const [letters, setLetters] = useState<TravelInvitation[]>([]);
    const [selected, select] = useState('');
    const [recipient, setRecipient] = useState('');
    const [occasion, setOccasion] = useState<InvitationOccasion>('gift');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [reload, refresh] = useState(0);
    const draftId = useRef('');
    const working = useRef(false);
    const alive = useRef(false);
    const controller = useRef<AbortController>();
    const letter = letters.find(item => item.id === selected);
    const actor = characters.find(c => c.id === (letter?.charId || recipient));

    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; controller.current?.abort(); };
    }, []);
    useEffect(() => {
        let current = true;
        const changed = () => refresh(n => n + 1);
        window.addEventListener(INVITATIONS_CHANGED, changed);
        listInvitations().then(items => { if (current) { setLetters(items); setLoaded(true); } })
            .catch(() => { if (current) { setError('邀请暂时读不到，请重试。'); setLoaded(false); } });
        return () => { current = false; window.removeEventListener(INVITATIONS_CHANGED, changed); };
    }, [reload]);

    function back() {
        if (working.current && !controller.current) return true;
        if (working.current && controller.current) controller.current.abort();
        if (page === 'planning') { setPage('letter'); setError(''); return true; }
        if (page === 'list') return false;
        setPage('list'); setError(''); return true;
    }
    useLocalBackHandler(back, 30);
    useAppShortcut(AppID.Voyage, async (intent, isCurrent) => {
        if (!intent.resourceId) return;
        try {
            const items = await listInvitations();
            if (!isCurrent()) return;
            const target = items.find(item => item.id === intent.resourceId && item.charId === intent.characterId);
            if (target && characters.some(c => c.id === target.charId)) show(target);
            else setError('这封邀请已不在当前用户空间。');
        } catch { if (isCurrent()) setError('邀请暂时读不到，请重试。'); }
    });
    function compose() {
        draftId.current = createLocalId(); select('');
        setRecipient(characters.find(c => c.id === activeCharacterId)?.id || characters[0]?.id || '');
        setNote(''); setOccasion('gift'); setError(''); setPage('compose');
    }
    function show(item: TravelInvitation) {
        setLetters(items => [item, ...items.filter(r => r.id !== item.id)].sort((a, b) => b.sentAt - a.sentAt));
        select(item.id); setError(''); setPage('letter');
    }
    async function run(action: 'send' | 'reply') {
        if (working.current || !actor) return;
        working.current = true; setBusy(true); setError('');
        try {
            if (action === 'send') {
                const sent = await sendInvitation(draftId.current, actor.id, occasion, note);
                trackVoyageResult(action, true);
                if (alive.current) show(sent);
            } else if (letter) {
                controller.current = new AbortController();
                const answered = await requestInvitationReply(letter, actor, userProfile, apiConfig, controller.current.signal);
                trackVoyageResult(action, true);
                if (alive.current && !controller.current.signal.aborted) show(answered);
            }
        } catch (cause) {
            if (alive.current && !controller.current?.signal.aborted) {
                setError(cause instanceof Error ? cause.message : '暂时未能完成，请重试。');
                trackVoyageResult(action, false);
            }
        } finally { controller.current = undefined; working.current = false; if (alive.current) setBusy(false); }
    }

    return <div className={`voyage-app ${theme.darkMode ? 'voyage-dark' : ''}`} style={{ '--voyage-hue': theme.hue } as React.CSSProperties}>
        <header className="voyage-bar"><button aria-label="返回" onClick={() => { if (!back()) closeApp(); }}><CaretLeft size={22}/></button>
            <h1>{{ list: '旅迹', compose: '写邀请', letter: '邀请详情', planning: '旅行策划', context: '策划资料' }[page]}</h1>
            {page === 'list' && characters.length > 0 && <button aria-label="写旅行邀请" onClick={compose}><PencilSimpleLine size={22}/></button>}
        </header>
        <main className="voyage-body">
            {page === 'list' && <>
                <section className="voyage-gift"><EnvelopeOpen size={36} weight="duotone"/>
                    <h2>旅行邀请</h2><button className="voyage-primary" disabled={!characters.length} onClick={compose}>写一封邀请 <PaperPlaneTilt size={16}/></button>
                </section>
                {characters.length > 0 && <button className="voyage-row" onClick={() => {
                    select(''); setRecipient(characters.find(c => c.id === activeCharacterId)?.id || characters[0].id);
                    setError(''); setPage('context');
                }}><SlidersHorizontal size={22}/><span>策划资料</span><CaretRight size={16}/></button>}
                {!characters.length && <button className="voyage-link" onClick={() => openApp(AppID.Character)}>去神经链接添加角色</button>}
                <h3>已送出的邀请</h3>
                {letters.filter(item => characters.some(c => c.id === item.charId)).map(item => {
                    const c = characters.find(c => c.id === item.charId)!;
                    return <button className="voyage-row" key={item.id} onClick={() => show(item)}>
                        <TokenImg src={c.avatar} alt="" className="voyage-avatar"/><span><strong>{c.name}</strong><small>{invitationTitle(item.occasion)} · {sentDate(item.sentAt)}</small></span>
                        <em>{invitationStatus(item)}</em><CaretRight size={15}/></button>;
                })}
                {loaded && !letters.some(item => characters.some(c => c.id === item.charId)) && <p className="voyage-muted">还没有送出的邀请</p>}
                {!loaded && !error && <p className="voyage-muted" role="status">正在读信…</p>}
            </>}
            {page === 'context' && <>
                <label className="voyage-field">角色<select value={recipient} onChange={e => setRecipient(e.target.value)}>
                    {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
                {actor && <VoyageCharacterSettings key={actor.id} actor={actor} library={worldbooks}/>}
            </>}
            {page === 'compose' && <>
                <label className="voyage-field">收件人<select value={recipient} onChange={e => setRecipient(e.target.value)}>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <div className="voyage-switch" aria-label="邀请类型">{(['gift', 'birthday'] as const).map(kind => <button key={kind} aria-pressed={occasion === kind} onClick={() => setOccasion(kind)}>{kind === 'gift' ? '旅行赠礼' : '生日赠礼'}</button>)}</div>
                <section className="voyage-paper"><Suitcase size={27}/><h2>{invitationTitle(occasion)}</h2>
                    <p>旅费全免，目的地、出发日和同行者由收件人决定。</p>
                    <label className="voyage-field">你的留言<textarea value={note} maxLength={600} rows={4} placeholder="想写给对方的话" onChange={e => setNote(e.target.value)}/></label>
                </section>
                <button className="voyage-primary" disabled={busy || !actor} onClick={() => void run('send')}>{busy ? '正在送出…' : '送出邀请'} <PaperPlaneTilt size={17}/></button>
            </>}
            {page === 'letter' && letter && <>
                <section className="voyage-paper"><EnvelopeOpen size={29}/><small>{sentDate(letter.sentAt)} · {invitationStatus(letter)}</small>
                    <h2>{invitationTitle(letter.occasion)}</h2><strong>给{actor?.name || '收件人'}</strong>
                    {letter.note && <p className="voyage-letter-text">{letter.note}</p>}<p className="voyage-muted">旅费全免 · {letter.approvedPlan ? '行程已批准' : '出发日待定'}</p>
                </section>
                {letter.reply ? <section className="voyage-answer"><h3>{actor?.name}的回信</h3><p className="voyage-letter-text">{letter.reply.text}</p></section>
                    : <button className="voyage-primary" disabled={busy || !actor} onClick={() => void run('reply')}>{busy ? '正在等回信…' : '请对方回信'}</button>}
                {letter.reply?.decision === 'later' && <button className="voyage-link" disabled={busy || !actor} onClick={() => void run('reply')}>{busy ? '正在等回信…' : '再问问对方'}</button>}
                {letter.reply?.decision === 'accept' && <button className="voyage-primary" onClick={() => setPage('planning')}>{letter.approvedPlan ? '查看行程' : '旅行策划'} <CaretRight size={16}/></button>}
                {actor && <button className="voyage-link" disabled={busy} onClick={() => { setActiveCharacterId(actor.id); openApp(AppID.Chat); }}>去聊天 <CaretRight size={15}/></button>}
            </>}
            {page === 'planning' && letter && actor && <VoyagePlanning key={letter.id} letter={letter} actor={actor} worldbooks={worldbooks}/>}
            {error && <div role="alert" className="voyage-error">{error}{page === 'list' && <button onClick={() => { setError(''); refresh(n => n + 1); }}>重新读取</button>}</div>}
        </main>
    </div>;
}
