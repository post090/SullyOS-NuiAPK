import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordHomeLifeEvent, settleCharExpense } = vi.hoisted(() => ({
    recordHomeLifeEvent: vi.fn().mockResolvedValue(null),
    settleCharExpense: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./homeOps', () => ({ recordHomeLifeEvent }));
vi.mock('./walletOps', () => ({ settleTransfer: vi.fn(), settleCharExpense }));

import { ChatParser } from './chatParser';

const parse = (raw: string, messageTimestamp?: number, inheritMeta?: { source: 'active_msg_2'; activeMsg2: { messageId: string } }) =>
    ChatParser.parseAndExecuteActions(
        raw, 'char-home', '测试角色', vi.fn(),
        undefined, undefined, undefined, messageTimestamp, inheritMeta,
    );

beforeEach(() => {
    recordHomeLifeEvent.mockClear();
    settleCharExpense.mockClear();
});

describe('parseAndExecuteActions · HOME 生活事件', () => {
    it('解析并清除四类 HOME 标签，保留可见正文', async () => {
        const raw = [
            '咖啡机已经放好了，牛奶也补上了。',
            '[[ACTION:HOME:BUY|咖啡机|厨房|durable]]',
            '[[ACTION:HOME:BUY|牛奶|厨房|consumable|2026-11-25]]',
            '[[ACTION:HOME:RESTOCK|纸巾]]',
            '[[ACTION:HOME:CONSUME|旧牛奶]]',
            '[[ACTION:HOME:DISCARD|旧椅子]]',
        ].join('\n');

        const result = await parse(raw, 123456);
        expect(result).toBe('咖啡机已经放好了，牛奶也补上了。');
        expect(recordHomeLifeEvent).toHaveBeenCalledTimes(5);
        expect(recordHomeLifeEvent.mock.calls.map(call => call[1])).toEqual([
            { type: 'buy', name: '咖啡机', roomName: '厨房', kind: 'durable', expiryDate: undefined },
            { type: 'buy', name: '牛奶', roomName: '厨房', kind: 'consumable', expiryDate: '2026-11-25' },
            { type: 'restock', name: '纸巾', expiryDate: undefined, roomName: undefined },
            { type: 'consume', name: '旧牛奶' },
            { type: 'discard', name: '旧椅子' },
        ]);
        expect(recordHomeLifeEvent.mock.calls[0][2]).toMatchObject({
            source: 'chat', now: 123456, eventId: expect.stringContaining('char-home:123456:HOME:'),
        });
    });

    it('兼容全角冒号，并给相同重放指令生成稳定事件 ID', async () => {
        const raw = '[[ACTION：HOME：RESTOCK|牛奶|2026-11-25|厨房]]\n[[ACTION：HOME：RESTOCK|牛奶|2026-11-25|厨房]]';
        const result = await parse(raw, 888, {
            source: 'active_msg_2', activeMsg2: { messageId: 'active-home-1' },
        });
        expect(result).toBe('');
        expect(recordHomeLifeEvent).toHaveBeenCalledTimes(2);
        const firstId = recordHomeLifeEvent.mock.calls[0][2].eventId;
        const secondId = recordHomeLifeEvent.mock.calls[1][2].eventId;
        expect(firstId).toContain('active-home-1:HOME:');
        // 相同原文重放得到同一 ID，由 homeOps 保证只执行一次。
        expect(secondId).toBe(firstId);
    });

    it('普通 SPEND 只记账，不再通过用途猜测并修改栖居', async () => {
        const result = await parse('刚买了杯咖啡。[[ACTION:SPEND:32|一杯燕麦拿铁]]');
        expect(result).toBe('刚买了杯咖啡。');
        expect(settleCharExpense).toHaveBeenCalledWith({ charId: 'char-home', kind: 'spend', amount: '32', note: '一杯燕麦拿铁' });
        expect(recordHomeLifeEvent).not.toHaveBeenCalled();
    });
});
