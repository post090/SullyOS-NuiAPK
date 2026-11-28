import React, { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, MapPin } from '@phosphor-icons/react';
import { trackVoyageResult } from '../utils/voyage/analytics';
import { saveApprovedPlan } from '../utils/voyage/invitations';
import type { TravelInvitation, TripDraft } from '../utils/voyage/letter';
import { allowChatReview, makeConnection, plannerRequestId, readConnection, readPlan, readPlannerStatus, rememberConnection, reviewPlan, submitBrief, type PlannerConnection, type PlannerRequest } from '../utils/voyage/planner';
import type { CharacterProfile, Worldbook } from '../types';
import VoyageContextFields, { useVoyageContext } from './VoyageContextFields';

const stateLabels = { requested: '等待策划', draft: '等你审核', returned: '已退回修改', approved: '行程已批准' };
type Operation = 'connect' | 'refresh' | 'submit' | 'approve' | 'return' | 'enableChat';

function PlanPaper({ draft, approved }: { draft: TripDraft; approved: boolean }) {
    const { destination, outline, weather, alternatives, sources, itinerary } = draft.content;
    return <article className="voyage-paper voyage-plan">
        <MapPin size={25}/><small>{approved ? '已批准' : '待审核'} · 第 {draft.version} 版</small>
        <h2>{destination}</h2><p>{outline}</p>
        {itinerary && <section className="voyage-stops">
            <h3>分站行程</h3><small>当地时间 · {itinerary.timeZone}</small>
            {itinerary.stops.map((stop, index) => <details key={index}>
                <summary><span>第 {stop.day} 天 · {stop.startLocal} · {stop.durationMinutes} 分钟</span><strong>{stop.place}</strong></summary>
                <dl>
                    <dt>怎么到</dt><dd>{stop.route}</dd>
                    <dt>预计当地费用</dt><dd>{stop.cost}</dd>
                    <dt>天气与备选</dt><dd>{stop.weatherPlan}</dd>
                    <dt>地点与故事</dt><dd>{stop.placeNotes}</dd>
                    <dt>到站可留意</dt><dd>{stop.scene}</dd>
                    <dt>可以怎么选</dt><dd><ul>{stop.choices.map(choice => <li key={choice}>{choice}</li>)}</ul></dd>
                    <dt>本站来源</dt><dd>{stop.sourceNumbers.map(n => {
                        const url = sources[n - 1];
                        return url && /^https:\/\//i.test(url) && <a key={n} href={url} target="_blank" rel="noopener noreferrer">来源 {n}</a>;
                    })}</dd>
                </dl>
            </details>)}
        </section>}
        <h3>当地天气</h3><p>{weather}</p><h3>天气备选</h3><p>{alternatives}</p>
        <h3>资料来源</h3><ul>{sources.filter(url => /^https:\/\//i.test(url)).map((url, index) =>
            <li key={index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul>
    </article>;
}

export default function VoyagePlanning({ letter, actor, worldbooks }: { letter: TravelInvitation; actor: Pick<CharacterProfile, 'id' | 'systemPrompt' | 'mountedWorldbooks'>; worldbooks: Worldbook[] }) {
    const [connection, setConnection] = useState(readConnection);
    const [address, setAddress] = useState(connection?.origin || '');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<Awaited<ReturnType<typeof readPlannerStatus>> | null>(null);
    const context = useVoyageContext(actor, worldbooks);
    const [request, setRequest] = useState<PlannerRequest | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [brief, setBrief] = useState('');
    const [feedback, setFeedback] = useState('');
    const [returning, setReturning] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<AbortController | null>(null);
    const cachedConnection = useRef(connection);

    async function run(op: Operation, supplied?: PlannerConnection) {
        if (pending.current) return;
        const controller = new AbortController();
        const { signal } = controller;
        pending.current = controller;
        setBusy(true); setError('');
        try {
            const c = supplied ?? (op === 'connect' ? makeConnection(address, password) : connection);
            if (!c) throw new Error('请先连接旅行服务。');
            const id = await plannerRequestId(letter);
            let row: PlannerRequest | null;
            if (op === 'refresh' || op === 'connect') {
                const [service, remote] = await Promise.all([readPlannerStatus(c, signal), readPlan(c, id, signal)]);
                if (signal.aborted) return;
                setStatus(service); setConnection(c); cachedConnection.current = c; rememberConnection(c); setPassword('');
                row = remote;
            } else if (op === 'submit') {
                if (context.reference && !status?.characterReference) throw new Error('请更新旅行服务以发送角色资料，或选择只发送简报。');
                await context.save();
                row = await submitBrief(c, id, brief, signal, context.reference, status?.chatReviewAvailable);
            } else if (op === 'enableChat') {
                row = await allowChatReview(c, id, signal);
            } else {
                if (!request?.draft || request.state !== 'draft') throw new Error('请先刷新草稿。');
                row = await reviewPlan(c, id, request.draft, op, feedback, signal);
            }
            if (row?.state === 'approved' && row.approvedDraft) await saveApprovedPlan(letter.id, letter.charId, row.approvedDraft);
            if (signal.aborted) return;
            setRequest(row); setLoaded(true); setReturning(false); setFeedback('');
            trackVoyageResult(op, true);
        } catch (cause) {
            if (!signal.aborted) {
                setError(cause instanceof Error ? cause.message : '旅行服务连接失败。');
                trackVoyageResult(op, false);
            }
        } finally {
            if (pending.current === controller) { pending.current = null; setBusy(false); }
        }
    }
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState !== 'hidden' && !letter.approvedPlan && cachedConnection.current) void run('refresh', cachedConnection.current);
        };
        refresh();
        document.addEventListener('visibilitychange', refresh);
        return () => { document.removeEventListener('visibilitychange', refresh); pending.current?.abort(); pending.current = null; };
    }, [letter.id, letter.charId, letter.approvedPlan]);

    function disconnect() {
        rememberConnection(null); cachedConnection.current = null; setConnection(null); setStatus(null); setRequest(null);
        setAddress(''); setPassword(''); setLoaded(false); setError(''); setReturning(false); setFeedback('');
    }
    const approved = letter.approvedPlan ?? request?.approvedDraft;
    if (approved) return <div className="voyage-planning"><PlanPaper draft={approved} approved/>
        {connection && <button className="voyage-link" onClick={disconnect}>断开本机连接</button>}</div>;
    return <div className="voyage-planning">
        {connection ? <section className="voyage-connection">
            <strong>{!status ? '旅行策划' : status.subscriptions > 0 ? 'Dot 已订阅' : '等待 Dot 订阅'}</strong>
            <div className="voyage-tools"><button disabled={busy} onClick={() => void run('refresh')}><ArrowsClockwise size={16}/>刷新</button>
                <button disabled={busy} onClick={disconnect}>断开本机连接</button></div>
        </section> : <section className="voyage-paper">
            <h3>连接旅行服务</h3>
            <label className="voyage-field">服务地址<input type="url" autoCapitalize="none" spellCheck={false} value={address} placeholder="https://" onChange={e => { setAddress(e.target.value); setPassword(''); }}/></label>
            <label className="voyage-field">设备配对码<input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)}/></label>
            <button className="voyage-primary" disabled={busy || !address || !password} onClick={() => void run('connect')}>连接</button>
        </section>}
        {!request && (!connection || loaded) && <VoyageContextFields context={context} busy={busy}/>}
        {loaded && connection && !request && <section className="voyage-paper">
            <label className="voyage-field">给 Dot 的旅行简报<textarea rows={5} maxLength={2000} value={brief} onChange={e => setBrief(e.target.value)} placeholder="想去哪里，何时有空，有什么期待"/></label>
            {letter.reply && <button className="voyage-link" disabled={busy} onClick={() => setBrief(letter.reply!.text)}>采用对方的回信</button>}
            <button className="voyage-primary" disabled={busy || !context.choice || !brief.trim()} onClick={() => void run('submit')}>
                {status?.chatReviewAvailable ? '发给点点，在聊天中审核' : '提交旅行简报'}</button>
        </section>}
        {request && <section className="voyage-answer">
            <h3>{stateLabels[request.state]}</h3><details><summary>已发送的简报</summary><p className="voyage-letter-text">{request.brief}</p></details>
            {request.referenceText && <details><summary>已发送的角色资料</summary><p className="voyage-letter-text">{request.referenceText}</p></details>}
            {request.reviewMode === 'chat' && request.state === 'draft' && <p>在点点的聊天里回复「通过」，或告诉它想改哪里。</p>}
            {request.reviewMode === 'device' && status?.chatReviewAvailable && <button className="voyage-link" disabled={busy} onClick={() => void run('enableChat')}>改为在点点聊天中审核</button>}
            {request.state === 'returned' && <p className="voyage-letter-text">修改意见 · {request.feedback}</p>}
        </section>}
        {request?.state === 'draft' && request.draft && <>
            <PlanPaper draft={request.draft} approved={false}/>
            {request.reviewMode === 'device' && (returning ? <section className="voyage-paper">
                <label className="voyage-field">修改意见<textarea rows={3} maxLength={1000} value={feedback} onChange={e => setFeedback(e.target.value)}/></label>
                <button className="voyage-primary" disabled={busy || !feedback.trim()} onClick={() => void run('return')}>发送修改意见</button>
                <button className="voyage-link" disabled={busy} onClick={() => setReturning(false)}>取消</button>
            </section> : <div className="voyage-tools"><button className="voyage-primary" disabled={busy} onClick={() => void run('approve')}>批准第 {request.draft.version} 版</button>
                <button disabled={busy} onClick={() => setReturning(true)}>退回修改</button></div>)}
        </>}
        {busy && <p className="voyage-muted" role="status">正在同步…</p>}
        {error && <p className="voyage-error" role="alert">{error}</p>}
    </div>;
}
