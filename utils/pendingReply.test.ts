import { describe, expect, it } from 'vitest';
import { getPendingReplyText } from './pendingReply';

describe('getPendingReplyText', () => {
    it('最后一条是未回复用户消息时返回 content', () => {
        expect(getPendingReplyText([
            { role: 'assistant', content: '在吗' },
            { role: 'user', content: '  在的  ' },
        ])).toBe('在的');
    });

    it('兼容通话气泡的 text 字段', () => {
        expect(getPendingReplyText([{ role: 'user', text: '再说一次' }])).toBe('再说一次');
    });

    it('最后已经有助手回复时不进入重试', () => {
        expect(getPendingReplyText([
            { role: 'user', content: '你好' },
            { role: 'assistant', content: '你好呀' },
        ])).toBe('');
    });

    it('空列表和空白用户消息都不进入重试', () => {
        expect(getPendingReplyText([])).toBe('');
        expect(getPendingReplyText([{ role: 'user', content: '   ' }])).toBe('');
    });
});
