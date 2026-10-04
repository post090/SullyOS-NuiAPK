import { describe, expect, it, vi } from 'vitest';
import { acquireChatReply, isChatReplyActive, subscribeChatReplies } from './chatReplyLock';
import { hasUnansweredUserTurn, withChatContinuation } from './chatContinuation';

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

    it('用户发言后才收进来的主动消息排在末尾时，提示回应用户那句话而不是续说', () => {
        const atSend = [{ role: 'assistant', content: '晚安' }, { role: 'user', content: '我帮你选' }];
        const proactive = { role: 'assistant', content: '我手里还剩两枚游戏币', metadata: { activeMsg2: { taskId: '42' } } };
        const history = [...atSend, proactive];
        expect(hasUnansweredUserTurn(atSend, history)).toBe(true);
        const request = withChatContinuation(history, '小雨', { unansweredUserTurn: true });
        expect(request.slice(0, 3)).toEqual(history);
        expect(request[3].role).toBe('user');
        expect(request[3].content).toContain('小雨刚才说的话还没有人回');
        expect(request[3].content).not.toContain('接着说');
        // 没按发送就让角色继续（点发送时最后说话的本来就是角色）仍是续说
        expect(hasUnansweredUserTurn(history, history)).toBe(false);
        // 落进来的是上一轮迟到的即时对话回复（taskId 为空）：那句话已经有人回了
        const lateReply = { role: 'assistant', content: '好呀', metadata: { activeMsg2: { taskId: null } } };
        expect(hasUnansweredUserTurn(atSend, [...atSend, lateReply])).toBe(false);
        expect(hasUnansweredUserTurn(atSend, [...atSend, lateReply, proactive])).toBe(false);
        // 这轮没有收进新消息
        expect(hasUnansweredUserTurn(atSend, atSend)).toBe(false);
        expect(withChatContinuation(atSend, '小雨', { unansweredUserTurn: true })).toBe(atSend);
    });

    it('新用户消息、图片及空历史不添加续说操作', () => {
        for (const history of [[], [{ role: 'user', content: '在吗' }], [
            { role: 'assistant', content: '你好' },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: 'test.png' } }] },
        ]]) expect(withChatContinuation(history)).toBe(history);
    });
});
