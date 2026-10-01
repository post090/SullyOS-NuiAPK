/**
 * SAR 临时模块 · 即时对话回复落库后的收尾。
 *
 * 本地生成路径的收尾在 useChatAI 里（外显写回、事件快照、推进回合）。即时对话的回复在
 * 云端生成、推送回来后由 activeMsgRuntime 在 React 之外落库，这里是同一套收尾的云端版：
 *   - 角色外显逐段随 push 带回（metadata.amsgSarSurface），落库时直接交给后处理，不经这里；
 *   - 其余三件事只在这一轮的末段做一次：USER_SURFACE 写回用户消息、事件快照写到本轮
 *     用户消息、推进角色 / 用户身上的模块回合。
 *
 * 一切按请求发出时冻结的快照（metadata.amsgSar）来：落库时现算会对不上——最新用户消息
 * 可能已经换了，模块可能已被手动结束，目标消息列表也不再是 prompt 里列的那份。
 *
 * 不依赖 React、不 import activeMsgRuntime，便于单测。
 */
import type { Message, SARModuleRuntimeState } from '../types';
import { DB } from './db';
import {
    createSARModuleSurfaceMeta,
    type AmsgSarModuleSnapshot,
    type SARModuleEventMeta,
    type SARModuleSurfaceMeta,
    type SARModuleSurfaceSource,
} from './vrWorld/sarEnvelopeCore';
import { advanceSARModuleAfterReply } from './vrWorld/sarModuleRuntime';
import { parseSARUserSurfaces } from './vrWorld/sarUserSurface';
import { SAR_MODULE_RUNTIME_CHANGED_EVENT, type SarModuleRuntimeChangedDetail } from './sarModuleRuntimeEvents';

const LOG_PREFIX = '[SAR·cloud]';

/**
 * push metadata 里这几个键只是回程的载具，不该留在任何一条气泡的 metadata 上。
 * 带 Ref 的是超出单条 push 上限时 worker 挪进 client_state 后留下的引用键（值即键）。
 */
export const AMSG_SAR_TRANSPORT_KEYS = [
    'amsgSar',
    'amsgSarRef',
    'amsgSarSurface',
    'amsgSarSurfaceRef',
    'amsgSarUserSurface',
    'amsgSarUserSurfaceRef',
] as const;

/** 剔掉 SAR 回程载具键，返回新对象（入参不动）。 */
export const stripAmsgSarTransportKeys = <T extends Record<string, any>>(metadata: T | null | undefined): T => {
    const next = { ...(metadata || {}) } as Record<string, any>;
    for (const key of AMSG_SAR_TRANSPORT_KEYS) delete next[key];
    return next as T;
};

const isObject = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * 读这条 push 那一段的角色外显（worker 已按段对齐好）。形状不对就当没有——宁可这一段
 * 显示真实回复，也不把一份来路不明的东西当外显盖上去。
 */
export const readAmsgSarSurface = (metadata: Record<string, any> | null | undefined): SARModuleSurfaceMeta | undefined =>
    parseAmsgSarSurface(metadata?.amsgSarSurface);

/** 同 readAmsgSarSurface 的校验，入参是外显 meta 本身（内联的或从旁路存储取回解析后的）。 */
export const parseAmsgSarSurface = (raw: unknown): SARModuleSurfaceMeta | undefined => {
    if (!isObject(raw)) return undefined;
    if (raw.version !== 1 || raw.phase !== 'active') return undefined;
    if (typeof raw.surface !== 'string' || !raw.surface.trim()) return undefined;
    return raw as SARModuleSurfaceMeta;
};

const isSurfaceSource = (value: unknown): value is SARModuleSurfaceSource => isObject(value)
    && typeof value.runId === 'string' && !!value.runId
    && (value.phase === 'active' || value.phase === 'afterglow');

/** 读末段上的快照（v1）。缺字段的列表按空处理，角色 / 用户两侧形状不对就当不在。 */
export const readAmsgSarSnapshot = (metadata: Record<string, any> | null | undefined): AmsgSarModuleSnapshot | undefined =>
    parseAmsgSarSnapshot(metadata?.amsgSar);

/** 同 readAmsgSarSnapshot 的校验，入参是快照本身（内联的或从旁路存储取回解析后的）。 */
export const parseAmsgSarSnapshot = (raw: unknown): AmsgSarModuleSnapshot | undefined => {
    if (!isObject(raw) || raw.v !== 1) return undefined;
    return {
        v: 1,
        character: isSurfaceSource(raw.character) ? raw.character : undefined,
        user: isSurfaceSource(raw.user) ? raw.user : undefined,
        events: Array.isArray(raw.events) ? raw.events.filter(isObject) as SARModuleEventMeta[] : [],
        userMessageId: typeof raw.userMessageId === 'number' ? raw.userMessageId : undefined,
        userSurfaceTargetIds: Array.isArray(raw.userSurfaceTargetIds)
            ? raw.userSurfaceTargetIds.filter((id: unknown): id is number => typeof id === 'number')
            : [],
        reroll: raw.reroll === true,
    };
};

/**
 * 从旁路存储取回一份 SAR 回程内容的函数：由调用方按 metadata 上的引用键去 client_state 读，
 * 读不到返回 null、不抛（取回后登记删除也归调用方管）。
 */
export type SarOffloadedFetcher = () => Promise<string | null>;

const parseOffloadedJson = (raw: string | null, what: string): unknown => {
    if (raw == null) return undefined;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`${LOG_PREFIX} 旁路存储里的${what}不是合法 JSON，按没有处理`, { error });
        return undefined;
    }
};

/**
 * 这一段的角色外显：内联的优先；没有且带 amsgSarSurfaceRef 时去旁路存储取回再过同一道校验。
 * 取不回 / 解析不了都只 warn、返回 undefined——外显丢了这一段就显示真实回复，
 * 不值得为此把整条消息压回收件箱重试。
 */
export const resolveAmsgSarSurface = async (
    metadata: Record<string, any> | null | undefined,
    fetchOffloaded: SarOffloadedFetcher,
): Promise<SARModuleSurfaceMeta | undefined> => {
    const inline = readAmsgSarSurface(metadata);
    if (inline) return inline;
    const ref = metadata?.amsgSarSurfaceRef;
    if (typeof ref !== 'string' || !ref) return undefined;
    const parsed = parseAmsgSarSurface(parseOffloadedJson(await fetchOffloaded(), '角色外显'));
    if (!parsed) console.warn(`${LOG_PREFIX} 这一段的角色外显没取回来，显示真实回复`, { ref });
    return parsed;
};

/**
 * 末段的快照：内联的优先；没有且带 amsgSarRef 时去旁路存储取回再过同一道校验。
 * 取不回就整轮不收尾（只 warn）——没有快照就不知道该推进哪一份模块。
 */
export const resolveAmsgSarSnapshot = async (
    metadata: Record<string, any> | null | undefined,
    fetchOffloaded: SarOffloadedFetcher,
): Promise<AmsgSarModuleSnapshot | undefined> => {
    if (metadata?.amsgSar !== undefined) return readAmsgSarSnapshot(metadata);
    const ref = metadata?.amsgSarRef;
    if (typeof ref !== 'string' || !ref) return undefined;
    const parsed = parseAmsgSarSnapshot(parseOffloadedJson(await fetchOffloaded(), '快照'));
    if (!parsed) console.warn(`${LOG_PREFIX} 快照没取回来，这一轮不做 SAR 收尾`, { ref });
    return parsed;
};

export interface SarCloudSettleInput {
    charId: string;
    snapshot: AmsgSarModuleSnapshot;
    /** USER_SURFACE 原文（内联的，或调用方从 client_state 取回的）；没有就不写用户外显。 */
    userSurfaceRaw?: string | null;
}

export interface SarCloudSettleResult {
    /** 写上外显的用户消息 id。 */
    userSurfaceIds: number[];
    /** 事件快照有没有写上。 */
    eventsWritten: boolean;
    /** 两侧的回合是否真的在 DB 里变了（没模块 / 重掷 / 对不上装载都算 false）。 */
    advanced: { character: boolean; user: boolean };
    /** 有没有改过任何消息的 metadata（调用方据此让聊天界面重读一次）。 */
    messagesTouched: boolean;
}

const dispatchRuntimeChanged = (detail: SarModuleRuntimeChangedDetail) => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(SAR_MODULE_RUNTIME_CHANGED_EVENT, { detail }));
};

const writeUserSurfaces = async (input: SarCloudSettleInput): Promise<number[]> => {
    const { snapshot, charId } = input;
    const userState = snapshot.user;
    if (userState?.phase !== 'active') return [];
    const raw = input.userSurfaceRaw;
    if (!raw?.trim() || snapshot.userSurfaceTargetIds.length === 0) return [];

    const targets: Message[] = [];
    for (const id of snapshot.userSurfaceTargetIds) {
        const message = await DB.getMessageById(id);
        // 丢了（用户删了 / 重掷清掉了）或者不是这段对话里用户说的话：跳过，不猜落点。
        if (!message || message.charId !== charId || message.role !== 'user') continue;
        targets.push(message);
    }
    const written: number[] = [];
    for (const [messageId, surface] of parseSARUserSurfaces(raw, targets)) {
        const meta = createSARModuleSurfaceMeta(userState, surface);
        if (!meta) continue;
        try {
            await DB.updateMessageMetadata(messageId, previous => ({ ...(previous || {}), sarModuleSurface: meta }));
            written.push(messageId);
        } catch (error) {
            console.warn(`${LOG_PREFIX} 用户外显写回失败，这一条保持原样`, { messageId, error });
        }
    }
    return written;
};

const writeEvents = async (snapshot: AmsgSarModuleSnapshot): Promise<boolean> => {
    if (snapshot.events.length === 0 || !snapshot.userMessageId) return false;
    try {
        await DB.updateMessageMetadata(snapshot.userMessageId, previous => ({
            ...(previous || {}),
            sarModuleEvents: snapshot.events,
        }));
        return true;
    } catch (error) {
        // 本轮用户消息已经不在了（删了 / 重掷替换），事件没有落点就算了。
        console.warn(`${LOG_PREFIX} 事件快照写回失败`, { messageId: snapshot.userMessageId, error });
        return false;
    }
};

/**
 * 只改 vrState.sarModule 这一个字段；变成 undefined 时把键删掉。
 * 只在回合真的变了时调用，那时 vrState 一定已经存在（模块就挂在它上面）。
 */
const withSarModule = <T extends { vrState?: { sarModule?: SARModuleRuntimeState } }>(
    owner: T,
    next: SARModuleRuntimeState | undefined,
): T => {
    const vrState = { ...owner.vrState } as NonNullable<T['vrState']>;
    if (next === undefined) delete vrState.sarModule;
    else vrState.sarModule = next;
    return { ...owner, vrState };
};

const advanceCharacter = async (charId: string, requested: SARModuleSurfaceSource): Promise<boolean> => {
    const fresh = (await DB.getAllCharacters()).find(c => c.id === charId);
    if (!fresh) return false;
    const current = fresh.vrState?.sarModule;
    const next = advanceSARModuleAfterReply(current, requested);
    if (next === current) return false;
    await DB.saveCharacter(withSarModule(fresh, next));
    return true;
};

const advanceUser = async (requested: SARModuleSurfaceSource): Promise<boolean> => {
    const fresh = await DB.getUserProfile();
    if (!fresh) return false;
    const current = fresh.vrState?.sarModule;
    const next = advanceSARModuleAfterReply(current, requested);
    if (next === current) return false;
    await DB.saveUserProfile(withSarModule(fresh, next));
    return true;
};

/**
 * 即时对话一轮回复落定后的 SAR 收尾。调用方保证同一轮只调一次（挂在销账块里）。
 *
 * 各项互不连累：哪一项失败只 warn，别的照做；整体也不抛——消息已经落库是事实，
 * 收尾不全不值得把整条消息压回收件箱重试（重试会重复推进回合）。
 */
export const settleSarModuleAfterCloudReply = async (input: SarCloudSettleInput): Promise<SarCloudSettleResult> => {
    const { charId, snapshot } = input;
    const result: SarCloudSettleResult = {
        userSurfaceIds: [],
        eventsWritten: false,
        advanced: { character: false, user: false },
        messagesTouched: false,
    };

    try {
        result.userSurfaceIds = await writeUserSurfaces(input);
    } catch (error) {
        console.warn(`${LOG_PREFIX} 用户外显收尾失败`, { charId, error });
    }
    try {
        result.eventsWritten = await writeEvents(snapshot);
    } catch (error) {
        console.warn(`${LOG_PREFIX} 事件快照收尾失败`, { charId, error });
    }
    result.messagesTouched = result.userSurfaceIds.length > 0 || result.eventsWritten;

    // 重掷是替换旧回合：效果照用，但不重复扣寿命（与本地路径一致）。
    if (snapshot.reroll) return result;

    // 按请求时的 runId + phase 推进 DB 里最新那份：用户中途换了模块 / 手动结束了，
    // 对不上就原样不动。推没推成都派一次事件，让内存对齐 DB。
    if (snapshot.character) {
        try {
            result.advanced.character = await advanceCharacter(charId, snapshot.character);
        } catch (error) {
            console.warn(`${LOG_PREFIX} 推进角色模块回合失败`, { charId, error });
        }
        dispatchRuntimeChanged({ target: 'character', charId });
    }
    if (snapshot.user) {
        try {
            result.advanced.user = await advanceUser(snapshot.user);
        } catch (error) {
            console.warn(`${LOG_PREFIX} 推进用户模块回合失败`, { charId, error });
        }
        dispatchRuntimeChanged({ target: 'user', charId });
    }
    return result;
};
