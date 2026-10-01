import { describe, expect, it } from 'vitest';
import type { AiSession } from '../types';
import { normalizePhoneAiSession, phoneTranscriptToText } from './phoneTranscript';

describe('phone transcript model/backup compatibility', () => {
    it('preserves existing strings exactly', () => {
        const text = '我: 第一句\n继续说\n\n对方: 收到';
        expect(phoneTranscriptToText(text)).toBe(text);
    });

    it('accepts arrays of lines and structured turns without losing speaker ownership', () => {
        expect(phoneTranscriptToText([
            '我: 在吗', { role: 'assistant', content: '在\n你说' },
            { speaker: '我', text: '第一句\n第二句' }, { isMe: false, text: '收到' },
        ])).toBe('我: 在吗\n对方: 在\n对方: 你说\n我: 第一句\n我: 第二句\n对方: 收到');
    });

    it('retains readable object content and accepts null/scalar values', () => {
        expect(phoneTranscriptToText({ 我: '难过', 对方: '我在听' })).toBe('我: 难过\n对方: 我在听');
        expect(phoneTranscriptToText({ unexpected: ['一', '二'] })).toBe('unexpected: 一\n二');
        expect(phoneTranscriptToText(null)).toBe('');
        expect(phoneTranscriptToText(123)).toBe('123');
    });

    it('does not recurse forever on cyclic malformed data', () => {
        const cycle: unknown[] = ['我: 一']; cycle.push(cycle);
        expect(phoneTranscriptToText(cycle)).toBe('我: 一\n[循环引用]');
    });

    it('repairs restored session fields without mutating the saved record', () => {
        const raw = {
            id: 'old', service: 'claude', title: { 主题: '心事' }, serviceName: ['Claude'],
            transcript: [{ role: 'user', content: '最近很累' }, { role: 'assistant', content: '慢慢说' }],
            archived: ['我: 旧消息'], updatedAt: 1,
        };
        const normalized = normalizePhoneAiSession(raw as unknown as AiSession);
        expect(normalized).toMatchObject({ id: 'old', title: '主题: 心事', serviceName: 'Claude',
            transcript: '我: 最近很累\n对方: 慢慢说', archived: '我: 旧消息', updatedAt: 1 });
        expect(Array.isArray(raw.transcript)).toBe(true);
        expect(normalizePhoneAiSession(normalized)).toEqual(normalized);
    });
});
