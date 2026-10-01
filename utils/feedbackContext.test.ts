import { beforeEach, describe, expect, it } from 'vitest';
import type { CharacterProfile, Message, UserProfile } from '../types';
import { DB } from './db';
import { loadCharacterContextMessages } from './chatContextRange';
import { DatePrompts } from './datePrompts';

describe('各入口共用角色上下文范围', () => {
    beforeEach(() => localStorage.clear());
    const char = (mode: 'adaptive' | 'manual'): CharacterProfile => ({
        id: 'feedback-context', name: '角色', avatar: '', description: '', systemPrompt: '', memories: [],
        contextLimit: 10, contextRangeMode: mode, contextRangePolicyVersion: 1, autoArchiveEnabled: true,
    });
    const rows = (): Message[] => Array.from({ length: 60 }, (_, index) => ({
        id: index + 1, charId: 'feedback-context', role: index % 2 ? 'assistant' : 'user',
        type: 'text', content: `原文标记${index + 1}结束`, timestamp: 1700000000000 + index,
        metadata: { source: index < 10 ? 'chat' : index < 30 ? 'date' : 'call' },
    }));
    it('见面自适应不受残留 10 条影响，发送和重写都保留水位后的全部来源', async () => {
        localStorage.setItem('mp_lastMsgId_feedback-context', '10');
        for (const variant of ['send', 'reroll'] as const) {
            const result = await DatePrompts.buildSessionPayload({ char: char('adaptive'), userProfile: { name: '用户' } as UserProfile, allMsgs: rows(), emojis: [], userText: '现在', variant });
            const text = JSON.stringify(result.messages);
            expect(text).toContain('原文标记11结束');
            expect(text).toContain('原文标记31结束');
            expect(text).not.toContain('原文标记10结束');
        }
    });
    it('见面手动范围忽略水位线，感知开场也不会再固定截 50 条', async () => {
        localStorage.setItem('mp_lastMsgId_feedback-context', '58');
        const c = { ...char('manual'), contextLimit: 60 };
        const result = await DatePrompts.buildSessionPayload({ char: c, userProfile: { name: '用户' } as UserProfile, allMsgs: rows(), emojis: [], userText: '现在', variant: 'send' });
        expect(JSON.stringify(result.messages)).toContain('原文标记1结束');
        expect(JSON.stringify(DatePrompts.buildPeekPayload({ char: c, userProfile: { name: '用户' } as UserProfile, allMsgs: rows(), emojis: [] }))).toContain('原文标记1结束');
    });
    it('数据库入口支持按角色对象和 ID 读取，手动模式可跨过归档线', async () => {
        const c = { ...char('adaptive'), id: 'feedback-db' };
        await DB.saveCharacter(c);
        const ids: number[] = [];
        for (let i = 0; i < 24; i++) ids.push(await DB.saveMessage({ charId: c.id, role: 'user', type: 'text', content: `msg-${i}` }));
        localStorage.setItem(`mp_lastMsgId_${c.id}`, String(ids[3]));
        expect(await loadCharacterContextMessages(c.id)).toHaveLength(20);
        const manual = await loadCharacterContextMessages({ ...c, contextRangeMode: 'manual', contextLimit: 24 });
        expect(manual.map(row => row.id)).toEqual(ids);
    });
});
