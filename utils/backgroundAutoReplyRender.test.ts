import { describe, expect, it, vi } from 'vitest';
import { DB } from './db';
import { createReplyRun } from './chatReplyCancellation';
import { renderAutoReplyWithChatPipeline, readChatTranslationConfig, type AutoReplyRenderInput } from './backgroundAutoReplyRender';

const makeInput = (charId: string, rawContent: string, extra: Partial<AutoReplyRenderInput> = {}): AutoReplyRenderInput => ({
    replyRun: createReplyRun(charId),
    rawContent,
    data: { choices: [{ message: { content: rawContent } }] },
    char: { id: charId, name: '测试角色', memoEnabled: true, memos: [] } as any,
    userProfile: { name: '我' } as any,
    emojis: [],
    contextMsgs: [],
    fullMessages: [],
    api: { baseUrl: 'http://localhost:0', headers: {}, effectiveApi: { baseUrl: 'http://localhost:0', apiKey: '', model: 'test' } },
    addToast: vi.fn(),
    onProgress: vi.fn(),
    instantRender: true,
    ...extra,
});

describe('后台自动回复走聊天页后处理', () => {
    it('执行备忘录标签，气泡里不留标签原文', async () => {
        const charId = `ar-memo-${Date.now()}`;
        const input = makeInput(charId, '好，我帮你记下了[[MEMO_ADD:周六去买花|type:todo]]\n到时候提醒你');
        const result = await renderAutoReplyWithChatPipeline(input);
        expect(result.status).toBe('done');
        expect(input.char.memos).toHaveLength(1);
        expect(input.char.memos![0].content).toBe('周六去买花');
        const msgs = await DB.getRecentMessagesByCharId(charId, 50);
        const texts = msgs.filter(m => m.role === 'assistant' && m.type === 'text').map(m => m.content);
        expect(texts.length).toBeGreaterThan(0);
        expect(texts.join('\n')).not.toContain('[[MEMO');
        expect(result.savedCount).toBe(texts.length);
        expect(result.preview).toContain('记下了');
        expect(input.onProgress).toHaveBeenCalled();
    }, 20000);

    it('被聊天页停止时不落库', async () => {
        const charId = `ar-stop-${Date.now()}`;
        const input = makeInput(charId, '这句话不该出现');
        input.replyRun.stop();
        const result = await renderAutoReplyWithChatPipeline(input);
        expect(result.status).toBe('stopped');
        expect(result.savedCount).toBe(0);
        const msgs = await DB.getRecentMessagesByCharId(charId, 50);
        expect(msgs.filter(m => m.role === 'assistant')).toHaveLength(0);
    }, 20000);

    it('读取聊天页按角色保存的双语设置', () => {
        localStorage.setItem('chat_translate_enabled_ar-tr', 'true');
        localStorage.setItem('chat_translate_source_lang_ar-tr', '日本語');
        localStorage.setItem('chat_translate_lang_ar-tr', '中文');
        expect(readChatTranslationConfig('ar-tr')).toEqual({ enabled: true, sourceLang: '日本語', targetLang: '中文' });
        localStorage.setItem('chat_translate_enabled_ar-tr', 'false');
        expect(readChatTranslationConfig('ar-tr')).toBeUndefined();
        expect(readChatTranslationConfig('ar-none')).toBeUndefined();
    });
});