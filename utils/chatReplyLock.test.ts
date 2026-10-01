import { describe, expect, it, vi } from 'vitest';
import { acquireChatReply, isChatReplyActive, subscribeChatReplies } from './chatReplyLock';
import { withChatContinuation } from './chatContinuation';

describe('手动回复边界', () => {
    it('同一帧只接纳一次；取消订阅/重新进入聊天不解除后台请求占位', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeChatReplies(listener);
        const release = acquireChatReply('a')!;
        expect(acquireChatReply('a')).toBeNull();
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        expect(isChatReplyActive('a')).toBe(true);
        expect(acquireChatReply('a')).toBeNull();
        const releaseB = acquireChatReply('b')!;
        releaseB();
        expect(isChatReplyActive('a')).toBe(true);
        release();
        const releaseNext = acquireChatReply('a')!;
        release(); // 旧请求的重复清理不能误解锁下一轮
        expect(isChatReplyActive('a')).toBe(true);
        releaseNext();
        expect(isChatReplyActive('a')).toBe(false);
    });

    it('助手已答完时追加一次续说操作，保留原历史及消息角色', () => {
        const history = [
            { role: 'user', content: '今天怎么样' },
            { role: 'assistant', content: '很好。' },
            { role: 'system', content: '实时上下文' },
        ];
        const request = withChatContinuation(history, ' 小雨 ');
        expect(history).toHaveLength(3);
        expect(request.slice(0, 3)).toEqual(history);
        expect(request[3].role).toBe('user');
        expect(request[3].content).toBe('[小雨还想听你接着说。顺着刚才的话自然继续，只写你自己的话，说完就等小雨回应。]');
        expect(request[3].content).not.toContain('点击');
        expect(request[3].content).not.toContain('用户');
        expect(withChatContinuation(history, ' ')[3].content).toContain('对方还想听你接着说');
        expect(withChatContinuation(request)).toBe(request);
    });

    it('新用户消息、图片及空历史不添加续说操作', () => {
        for (const history of [[], [{ role: 'user', content: '在吗' }], [
            { role: 'assistant', content: '你好' },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: 'test.png' } }] },
        ]]) expect(withChatContinuation(history)).toBe(history);
    });
});
