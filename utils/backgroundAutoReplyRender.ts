/**
 * 后台自动回复的落库：跟聊天页走同一条后处理管线（applyAssistantPostProcessing）。
 *
 * 用户发完消息离开聊天后，OSContext 的全局流程代为请求模型；拿到回复后交给这里，
 * 这样备忘录、转账、日程、音乐、引用、回忆/搜索等二轮工具都和在聊天页里等着时一致。
 * 主动消息（定时找用户）不走这里，仍用 OSContext 里的精简版。
 */
import type { CharacterProfile, Emoji, EmojiCategory, GroupProfile, Message, RealtimeConfig, UserProfile } from '../types';
import { applyAssistantPostProcessing, type PostProcessMusicHooks, type XhsCaches } from './applyAssistantPostProcessing';
import { isReplyAbort, withReplyCancellation, type ReplyRun } from './chatReplyCancellation';
import { DB } from './db';
import { normalizeTranslationLangLabel } from './translationLang';

// 跨轮存活的小红书缓存（聊天页用 useRef 持有，这里是模块级单例）
const xhsCaches: XhsCaches = {
    xsecTokenCache: new Map(),
    noteTitleCache: new Map(),
    commentUserIdCache: new Map(),
    commentAuthorNameCache: new Map(),
    commentParentIdCache: new Map(),
};

/** 读聊天页按角色保存的双语设置（键名与 apps/Chat.tsx 一致）。没开返回 undefined。 */
export function readChatTranslationConfig(charId: string): { enabled: true; sourceLang: string; targetLang: string } | undefined {
    try {
        if (!JSON.parse(localStorage.getItem(`chat_translate_enabled_${charId}`) || 'false')) return undefined;
        const sourceLang = normalizeTranslationLangLabel(localStorage.getItem(`chat_translate_source_lang_${charId}`)
            || localStorage.getItem('chat_translate_source_lang') || '日本語') || '日本語';
        const targetLang = normalizeTranslationLangLabel(localStorage.getItem(`chat_translate_lang_${charId}`)
            || localStorage.getItem('chat_translate_lang') || '中文') || '中文';
        return { enabled: true, sourceLang, targetLang };
    } catch {
        return undefined;
    }
}

export interface AutoReplyRenderInput {
    /** 调用方在请求模型前建好；聊天页「停止」按角色停掉它 */
    replyRun: ReplyRun;
    rawContent: string;
    /** 首轮 API 响应（思考链从这里取，二轮工具会在内部覆盖） */
    data: any;
    /** 必须是内存里那份角色对象：后处理会就地改 memos 再落库，传副本会被下一次 updateCharacter 盖回旧值 */
    char: CharacterProfile;
    userProfile: UserProfile;
    emojis: Emoji[];
    categories?: EmojiCategory[];
    realtimeConfig?: RealtimeConfig;
    groups?: GroupProfile[];
    contextMsgs: Message[];
    fullMessages: any[];
    api: {
        baseUrl: string;
        headers: Record<string, string>;
        effectiveApi: { baseUrl: string; apiKey: string; model: string };
    };
    addToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    /** 每落一批消息调用一次，让界面刷新 */
    onProgress: () => void;
    musicHooks?: PostProcessMusicHooks;
    /** 用户没在看这个聊天时跳过打字延迟，一次落完 */
    instantRender: boolean;
}

export interface AutoReplyRenderResult {
    status: 'done' | 'stopped' | 'failed';
    /** 本轮新落库的角色消息条数 */
    savedCount: number;
    /** 通知用的摘要 */
    preview: string;
    error?: string;
}

const previewOf = (m: Message): string => {
    if (m.type === 'text') return String(m.content || '').replace(/%%BILINGUAL%%[\s\S]*/i, '').trim();
    if (m.type === 'emoji') return '[表情]';
    return String(m.content || '').trim().slice(0, 40) || '[卡片]';
};

export async function renderAutoReplyWithChatPipeline(input: AutoReplyRenderInput): Promise<AutoReplyRenderResult> {
    const { char } = input;
    const lastBefore = (await DB.getRecentMessagesByCharId(char.id, 1)).pop();
    const beforeId = lastBefore?.id ?? 0;
    const { replyRun } = input;
    let status: AutoReplyRenderResult['status'] = 'done';
    let error: string | undefined;
    try {
        await withReplyCancellation(replyRun, () => applyAssistantPostProcessing(input.rawContent, {
            replyRun,
            char,
            userProfile: input.userProfile,
            emojis: input.emojis,
            categories: input.categories,
            realtimeConfig: input.realtimeConfig,
            groups: input.groups,
            contextMsgs: input.contextMsgs,
            fullMessages: input.fullMessages,
            initialData: input.data,
            historyMsgCount: input.contextMsgs.length,
            xhsCaches,
            api: input.api,
            hooks: {
                setMessages: () => input.onProgress(),
                addToast: input.addToast,
                musicHooks: input.musicHooks,
            },
            instantRender: input.instantRender,
            skipSecondPassLLM: false,
            directives: [],
        }));
    } catch (e: any) {
        if (isReplyAbort(e)) {
            status = 'stopped';
        } else {
            status = 'failed';
            error = e?.message || String(e);
            console.error('[AutoReply/Global] 后处理失败', e);
            // 与聊天页同口径：留一条系统消息，别让这一轮静默消失
            await DB.saveMessage({ charId: char.id, role: 'system', type: 'text', content: `[回复处理失败: ${error}]` }).catch(() => {});
        }
    } finally {
        try { await replyRun.settle(); } catch (e) { console.error('[AutoReply/Global] 收尾失败', e); }
        input.onProgress();
    }
    const saved = (await DB.getRecentMessagesByCharId(char.id, 50))
        .filter(m => (m.id ?? 0) > beforeId && m.role === 'assistant');
    const preview = saved.map(previewOf).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return { status, savedCount: saved.length, preview, error };
}
