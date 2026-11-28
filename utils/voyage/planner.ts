import { SESSION_SPACE_ID } from '../userSpaces';
import type { TravelInvitation, TripDraft } from './letter';

export interface PlannerConnection { origin: string; token: string }
export interface PlannerRequest {
    id: string;
    brief: string;
    state: 'requested' | 'draft' | 'returned' | 'approved';
    feedback: string | null;
    draft: TripDraft | null;
    approvedDraft: TripDraft | null;
}
const sessionKey = 'voyage/planner/' + SESSION_SPACE_ID;

export function makeConnection(address: string, password: string): PlannerConnection {
    let url: URL;
    try { url = new URL(address.trim()); } catch { throw new Error('请填写完整的 HTTPS 服务地址。'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['/', '/mcp'].includes(url.pathname))
        throw new Error('请填写旅行服务的 HTTPS 根地址。');
    if (!/^[A-Za-z0-9_-]{36,96}$/.test(password.trim())) throw new Error('请填写设备配对码。');
    return { origin: url.origin, token: password.trim() };
}
export function rememberConnection(connection: PlannerConnection | null) {
    try {
        if (connection) sessionStorage.setItem(sessionKey, JSON.stringify(connection));
        else sessionStorage.removeItem(sessionKey);
    } catch { /* The current screen can still connect with session storage disabled. */ }
}
export function readConnection(): PlannerConnection | null {
    try {
        const saved = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
        return saved ? makeConnection(saved.origin, saved.token) : null;
    } catch { return null; }
}

// Copies imported as new characters get new request IDs. Neither local ID travels to the planner.
export async function plannerRequestId(letter: Pick<TravelInvitation, 'id' | 'charId'>) {
    const data = new TextEncoder().encode(JSON.stringify([letter.id, letter.charId]));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
function parseDraft(value: unknown): TripDraft | null {
    if (value === null) return null;
    const error = () => new Error('服务返回的草稿格式无效。');
    if (!isRecord(value) || !isRecord(value.content) || typeof value.digest !== 'string' || !/^[\da-f]{64}$/.test(value.digest)
        || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1) throw error();
    const { destination, outline, weather, alternatives, sources } = value.content;
    if (typeof destination !== 'string' || typeof outline !== 'string' || typeof weather !== 'string' || typeof alternatives !== 'string'
        || !Array.isArray(sources) || !sources.length || sources.length > 12) throw error();
    const links = sources.map((source: unknown) => {
        if (typeof source !== 'string') throw error();
        let url: URL;
        try { url = new URL(source); } catch { throw error(); }
        if (url.protocol !== 'https:' || url.username || url.password) throw error();
        return url.href;
    });
    return { version: value.version, digest: value.digest, content: { destination, outline, weather, alternatives, sources: links } };
}
function parseRequest(value: unknown, id: string): PlannerRequest {
    if (!isRecord(value) || value.id !== id || typeof value.brief !== 'string'
        || value.state !== 'requested' && value.state !== 'draft' && value.state !== 'returned' && value.state !== 'approved')
        throw new Error('旅行服务返回了不匹配的申请。');
    const draft = parseDraft(value.draft), approvedDraft = parseDraft(value.approvedDraft);
    if (['draft','returned','approved'].includes(value.state) && !draft ||
        value.state === 'approved' && (!approvedDraft || approvedDraft.digest !== draft?.digest || approvedDraft.version !== draft?.version))
        throw new Error('旅行服务返回的审批版本不一致。');
    return { id, brief: value.brief, state: value.state, feedback: typeof value.feedback === 'string' ? value.feedback : null, draft, approvedDraft };
}

async function deviceFetch(connection: PlannerConnection, path: string, signal: AbortSignal, body?: unknown, allowMissing = false): Promise<unknown> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal.aborted) cancel();
    signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, 20000);
    try {
        const response = await fetch(connection.origin + '/device/' + path, {
            method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
            cache: 'no-store', signal: controller.signal,
            headers: { Authorization: 'Bearer ' + connection.token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        if (allowMissing && response.status === 404) return null;
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error('设备配对码无效，请重新连接。');
            if (response.status === 409) throw new Error('云端版本已改变，请刷新后再操作。');
            throw new Error('旅行服务暂时无法处理，请稍后刷新。');
        }
        return await response.json();
    } catch (error) {
        if (signal.aborted) throw error;
        if (controller.signal.aborted || error instanceof TypeError) throw new Error('旅行服务连接失败，请检查网络和服务地址后刷新。');
        throw error;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}
export async function readSubscriptions(connection: PlannerConnection, signal: AbortSignal) {
    const result = await deviceFetch(connection, 'status', signal);
    if (!isRecord(result) || typeof result.subscriptions !== 'number' || result.subscriptions < 0) throw new Error('该地址没有返回旅行服务状态。');
    return result.subscriptions;
}
export async function readPlan(c: PlannerConnection, id: string, signal: AbortSignal) {
    const result = await deviceFetch(c, 'requests/' + encodeURIComponent(id), signal, undefined, true);
    return result === null ? null : parseRequest(result, id);
}
export async function submitBrief(c: PlannerConnection, id: string, brief: string, signal: AbortSignal) {
    if (!brief.trim() || brief.length > 2000) throw new Error('请填写 1 至 2000 字的旅行想法。');
    return parseRequest(await deviceFetch(c, 'requests/' + encodeURIComponent(id), signal, { brief: brief.trim() }), id);
}
export async function reviewPlan(c: PlannerConnection, id: string, draft: TripDraft, decision: 'approve' | 'return', feedback: string, signal: AbortSignal) {
    if (decision === 'return' && (!feedback.trim() || feedback.length > 1000)) throw new Error('请填写修改意见，限 1000 字。');
    const body = { decision, version: draft.version, digest: draft.digest, ...(decision === 'return' ? { feedback: feedback.trim() } : {}) };
    return parseRequest(await deviceFetch(c, 'requests/' + encodeURIComponent(id) + '/review', signal, body), id);
}
