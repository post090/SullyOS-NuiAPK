/**
 * SAR 临时模块的「信封」核心：模型回复容器的解析、外显与真意的逐泡对齐、外显 meta 的组装，
 * 以及即时对话上云时随任务走的快照形状。
 *
 * 这是零依赖叶子（只 import type），前端与 worker/amsg 共用同一份——云端生成的回复由 worker
 * 在分段之前拆信封，前端落库时按段接外显；两边对信封的理解必须是同一套代码。
 * 带商品目录 / 存储的部分留在 sarModuleRuntime.ts（它 re-export 这里的一切）。
 */
import type { SARModuleRuntimeState } from '../../types';

export interface SARModuleRuntimePlan {
    character?: SARModuleRuntimeState;
    user?: SARModuleRuntimeState;
    hasActiveEffect: boolean;
    hasAfterglow: boolean;
    requiresEnvelope: boolean;
}

export interface SARModuleParsedReply {
    canonical: string;
    assistantSurface?: string;
    userSurface?: string;
    enveloped: boolean;
}

export interface SARModuleSurfaceMeta {
    version: 1;
    runId: string;
    moduleId: string;
    moduleTitle: string;
    target: 'character' | 'user';
    phase: 'active';
    /** 界面按此外显；上下文/总结把它作为明确标注的历史引文读取，绝不当成真实语义。 */
    surface: string;
    canonicalField: 'content';
    surfaceField: 'metadata.sarModuleSurface.surface';
}

export interface SARModuleEventMeta {
    version: 1;
    runId: string;
    moduleId: string;
    moduleTitle: string;
    target: 'character' | 'user';
    source: 'user' | 'character';
    sourceCharacterId?: string;
    sourceCharacterName?: string;
    phase: 'active' | 'afterglow';
    moment: 'installed' | 'active' | 'ended' | 'settling';
    endReason?: 'manual';
    configurationKeyword?: string;
}

/** 组外显 meta 只用得到这几个字段；快照与 worker 侧都按这个最小形状传。 */
export type SARModuleSurfaceSource = Pick<
    SARModuleRuntimeState, 'runId' | 'moduleId' | 'moduleTitle' | 'target' | 'phase'
>;

/**
 * 即时对话上云时随任务 metadata（键 `amsgSar`）走的快照。请求发出那一刻冻结，回复落库时
 * 只按它收尾——落库时现算会对不上：那时最新用户消息可能已经换了、模块可能已被手动结束、
 * 目标消息列表也不再是 prompt 里列的那份。
 *
 * 只带收尾用得到的字段：模块的 description / effectLabel 不进来，这份会随 push 回程。
 */
export interface AmsgSarModuleSnapshot {
    v: 1;
    /** 角色身上的模块（请求时的阶段）。落库时按 runId + phase 推进最新状态。 */
    character?: SARModuleSurfaceSource;
    /** 用户身上的模块，同上。 */
    user?: SARModuleSurfaceSource;
    /** 发送时算好的事件快照，落库写到 userMessageId 那条消息的 metadata.sarModuleEvents。 */
    events: SARModuleEventMeta[];
    /** 本轮用户消息 id（事件快照的落点）；找不到时不写事件。 */
    userMessageId?: number;
    /** USER_SURFACE 的目标消息 id，与 prompt 里列给模型的是同一份。 */
    userSurfaceTargetIds: number[];
    /** 重掷：效果照用，但成功后不推进回合（与本地路径一致）。 */
    reroll: boolean;
}

export const toSARModuleSurfaceSource = (state: SARModuleRuntimeState): SARModuleSurfaceSource => ({
    runId: state.runId,
    moduleId: state.moduleId,
    moduleTitle: state.moduleTitle,
    target: state.target,
    phase: state.phase,
});

/** worker 拿快照还原出解信封所需的最小 plan；两边都没模块时返回 null。 */
export const planFromSARModuleSnapshot = (snapshot: AmsgSarModuleSnapshot | null | undefined): SARModuleRuntimePlan | null => {
    if (!snapshot || (!snapshot.character && !snapshot.user)) return null;
    const character = snapshot.character as SARModuleRuntimeState | undefined;
    const user = snapshot.user as SARModuleRuntimeState | undefined;
    const hasActiveEffect = character?.phase === 'active' || user?.phase === 'active';
    const hasAfterglow = character?.phase === 'afterglow' || user?.phase === 'afterglow';
    return { character, user, hasActiveEffect, hasAfterglow, requiresEnvelope: hasActiveEffect };
};

const isPlainSARChatActionOnlyChunk = (text: string): boolean => {
    const clean = text.trim();
    if (!clean) return false;
    return /^(?:(?:（[^（）]*）|\([^()]*\)|\*[^*\n]+\*)\s*)+[。！？!?…～~—-]*$/s.test(clean);
};

/** Chat 的动作气泡不应被外显文本覆盖；括号动作被模型从 CHAR_SURFACE 省略时尤其要防止后续台词错位。 */
export const isSARChatActionOnlyChunk = (text: string): boolean => {
    const bilingualParts = text.split(/%%BILINGUAL%%/i).map(part => part.trim()).filter(Boolean);
    return bilingualParts.length > 0 && bilingualParts.every(isPlainSARChatActionOnlyChunk);
};

const isSARChatHtmlPlaceholder = (text: string): boolean => /^\[HTML\s*卡片\]$/i.test(text.trim());

export const consumeSARChatSurfaceChunk = (
    canonicalChunk: string,
    surfaceChunks: string[],
    startIndex: number,
): { surface?: string; nextIndex: number } => {
    let index = Math.max(0, startIndex);
    // HTML disabled at delivery time becomes a canonical placeholder. It has no
    // rewritten speech and must not consume the following bubble's surface.
    if (isSARChatHtmlPlaceholder(canonicalChunk)) {
        if (surfaceChunks[index] && isSARChatHtmlPlaceholder(surfaceChunks[index])) index += 1;
        return { nextIndex: index };
    }
    if (isSARChatActionOnlyChunk(canonicalChunk)) {
        // 模型遵守“动作原位复制”时消费掉对应动作；省略动作时则保留指针给下一条台词。
        if (surfaceChunks[index] && isSARChatActionOnlyChunk(surfaceChunks[index])) index += 1;
        return { nextIndex: index };
    }
    // 外显里若意外多带了动作行，动作仍展示 canonical，跳过它后再取同位台词。
    while (surfaceChunks[index] && (isSARChatActionOnlyChunk(surfaceChunks[index]) || isSARChatHtmlPlaceholder(surfaceChunks[index]))) index += 1;
    const surface = surfaceChunks[index];
    return { surface, nextIndex: surface === undefined ? index : index + 1 };
};

export const alignSARChatSurfaceChunks = (
    canonicalChunks: string[],
    surfaceChunks: string[],
): Array<string | undefined> => {
    let index = 0;
    return canonicalChunks.map(canonical => {
        const consumed = consumeSARChatSurfaceChunk(canonical, surfaceChunks, index);
        index = consumed.nextIndex;
        return consumed.surface;
    });
};

const tag = (raw: string, name: string): string | undefined => {
    const match = raw.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`, 'i'));
    const value = match?.[1]?.trim();
    return value || undefined;
};

/** 模型不守容器时安全降级：原始输出视为真实回复，不猜、不污染 canonical。 */
export const parseSARModuleReply = (
    raw: string,
    plan: SARModuleRuntimePlan,
): SARModuleParsedReply => {
    // 无模块/只有已退场提示时保持原始回复字节不动：不 trim、不解析、不猜测。
    if (!plan.requiresEnvelope) return { canonical: raw, enveloped: false };
    const body = tag(raw, 'SAR_MODULE_OUTPUT') || raw;
    const canonical = tag(body, 'CHAR_TRUE');
    if (!canonical) return { canonical: raw.trim(), enveloped: false };
    return {
        canonical,
        assistantSurface: plan.character?.phase === 'active' ? tag(body, 'CHAR_SURFACE') : undefined,
        userSurface: plan.user?.phase === 'active' ? tag(body, 'USER_SURFACE') : undefined,
        enveloped: true,
    };
};

export const createSARModuleSurfaceMeta = (
    state: SARModuleSurfaceSource,
    surface: string,
): SARModuleSurfaceMeta | undefined => {
    const clean = surface.trim();
    if (!clean || state.phase !== 'active') return undefined;
    return {
        version: 1,
        runId: state.runId,
        moduleId: state.moduleId,
        moduleTitle: state.moduleTitle,
        target: state.target,
        phase: 'active',
        surface: clean,
        canonicalField: 'content',
        surfaceField: 'metadata.sarModuleSurface.surface',
    };
};
