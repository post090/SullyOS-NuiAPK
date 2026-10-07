// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { applyAssistantPostProcessing, type PostProcessCtx, type XhsCaches } from './applyAssistantPostProcessing';
import { DB } from './db';
import { mergeMemoDirectives, parseMemoDirectives, stripMemoTags } from './memos';
import type { CharacterProfile } from '../types';

const makeCtx = (char: CharacterProfile): PostProcessCtx => {
    const xhsCaches: XhsCaches = {
        xsecTokenCache: new Map(), noteTitleCache: new Map(),
        commentUserIdCache: new Map(), commentAuthorNameCache: new Map(), commentParentIdCache: new Map(),
    } as any;
    return {
        char, userProfile: { name: '我' } as any, emojis: [],
        contextMsgs: [], fullMessages: [], initialData: {}, historyMsgCount: 0, xhsCaches,
        api: { baseUrl: 'http://localhost:0', headers: {}, effectiveApi: { baseUrl: 'http://localhost:0', apiKey: '', model: 'test' } },
        hooks: { setMessages: vi.fn(), addToast: vi.fn() },
    } as any;
};

const memo = (id: string, content: string, updatedAt: number) => ({
    id, content, type: 'note' as const, status: 'active' as const, tags: [], createdAt: updatedAt, updatedAt,
});

describe('parseMemoDirectives 容错', () => {
    it('认全角冒号 / 全角竖线 / 中文字段名 / 序号写法', () => {
        const ds = parseMemoDirectives('[[MEMO_EDIT：第2条｜内容：新的]] [[memo_del: #3]] [[MEMO_EDIT:1|改成这个]]');
        expect(ds).toEqual([
            { kind: 'edit', index: 2, content: '新的' },
            { kind: 'del', index: 3 },
            { kind: 'edit', index: 1, content: '改成这个' },
        ]);
    });

    it('stripMemoTags 同口径剥离', () => {
        expect(stripMemoTags('好\n[[MEMO_EDIT：1｜内容：x]]\n嗯')).toBe('好\n嗯');
    });

    it('mergeMemoDirectives 两边都有的指令只算一次', () => {
        const a = parseMemoDirectives('[[MEMO_DEL:1]]');
        expect(mergeMemoDirectives(a, a)).toHaveLength(1);
        expect(mergeMemoDirectives(a, [])).toHaveLength(1);
    });
});

describe('角色改备忘录落库', () => {
    it('以 DB 最新角色为底写回，并通知内存同步', async () => {
        const now = Date.now();
        const id = `c-memo-${now}`;
        const stale: CharacterProfile = {
            id, name: '测试角色', memoEnabled: true,
            memos: [memo('m1', '第一条', now - 5000), memo('m2', '第二条', now)],
        } as any;
        await DB.saveCharacter({ ...stale, description: '生成期间别处改过' } as any);

        const events: any[] = [];
        const onEvt = (e: Event) => events.push((e as CustomEvent).detail);
        window.addEventListener('char-memos-updated', onEvt);
        try {
            await applyAssistantPostProcessing('好，我改一下。[[MEMO_EDIT:2|content:第一条（已改）]]', makeCtx(stale));
        } finally {
            window.removeEventListener('char-memos-updated', onEvt);
        }

        const after = await DB.getCharacter(id);
        expect(after?.memos?.find(m => m.id === 'm1')?.content).toBe('第一条（已改）');
        expect((after as any)?.description).toBe('生成期间别处改过');
        expect(events).toHaveLength(1);
        expect(events[0].charId).toBe(id);
        expect(events[0].memos.find((m: any) => m.id === 'm1').content).toBe('第一条（已改）');
    }, 20000);
});
