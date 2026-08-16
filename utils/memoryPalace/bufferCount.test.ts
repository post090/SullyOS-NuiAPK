import { describe, it, expect } from 'vitest';
import {
    countOneShotPendingMessages,
    countUnprocessedBufferMessages,
    getOneShotTargetHighWaterMark,
} from './bufferCount';
import { isMessageSemanticallyRelevant } from '../messageFormat';

/** 造一批 id 连续、内容非空的文本消息 */
const makeMsgs = (n: number, startId = 1) =>
    Array.from({ length: n }, (_, i) => ({ id: startId + i, type: 'text', content: 'x' })) as any;

describe('countUnprocessedBufferMessages（记忆宫殿未同步口径）', () => {
    it('消息数 <= 热区时恒为 0（全在热区，永远不会被处理）', () => {
        expect(countUnprocessedBufferMessages(makeMsgs(200), 0, 200)).toBe(0);
        // 小热区同理
        expect(countUnprocessedBufferMessages(makeMsgs(3), 0, 3)).toBe(0);
    });

    it('排除最后 N 条热区：250 条、hwm=0、热区200 → 只数前 50 条', () => {
        expect(countUnprocessedBufferMessages(makeMsgs(250), 0, 200)).toBe(50);
    });

    it('再排除已处理(id <= hwm)：250 条、hwm=30、热区200 → 50 里去掉前 30 = 20', () => {
        expect(countUnprocessedBufferMessages(makeMsgs(250), 30, 200)).toBe(20);
    });

    it('小热区精确边界：5 条、热区3、hwm=0 → 只有 id 1、2 落在缓冲区 = 2', () => {
        // 排序后 [1,2,3,4,5]，热区起点 = 倒数第 3 条 = id 3；缓冲区 = id>0 且 id<3 = {1,2}
        expect(countUnprocessedBufferMessages(makeMsgs(5), 0, 3)).toBe(2);
    });

    it('三档热区都沿用同一条角色时间线计算', () => {
        const msgs = makeMsgs(300);
        expect(countUnprocessedBufferMessages(msgs, 0, 200)).toBe(100);
        expect(countUnprocessedBufferMessages(msgs, 0, 100)).toBe(200);
        expect(countUnprocessedBufferMessages(msgs, 0, 50)).toBe(250);
    });

    it('乱序输入也按 id 排序后计算，结果一致', () => {
        const shuffled = [{ id: 5 }, { id: 1 }, { id: 3 }, { id: 2 }, { id: 4 }] as any;
        expect(countUnprocessedBufferMessages(shuffled, 0, 3)).toBe(2);
    });

    it('热区为 0 时会处理水位线后的全部语义消息', () => {
        expect(countUnprocessedBufferMessages(makeMsgs(5), 2, 0)).toBe(3);
    });

    it('回归守卫：绝不能退回 "id > hwm" 裸口径', () => {
        const msgs = makeMsgs(250); // id 1..250
        const naive = msgs.filter((m: any) => m.id > 0).length; // 裸口径 = 250
        const correct = countUnprocessedBufferMessages(msgs, 0, 200); // 正确 = 50
        expect(correct).toBe(50);
        expect(correct).not.toBe(naive); // 若有人改回裸过滤，这一行会挂
    });

    it('语音转写与 metadata 卡片进入同一水位线统计，纯媒体不计数', () => {
        const mixed = [
            { id: 1, type: 'text', content: '文字' },
            { id: 2, type: 'voice', content: '语音配套文字' },
            { id: 3, type: 'xhs_card', content: '', metadata: { xhsNote: { title: '卡片标题' } } },
            { id: 4, type: 'image', content: 'data:image/png;base64,AAAA' },
            { id: 5, type: 'emoji', content: 'blob:emoji' },
            { id: 6, type: 'voice', content: 'blob:voice' },
            { id: 7, type: 'text', content: '热区一' },
            { id: 8, type: 'text', content: '热区二' },
        ] as any;
        const semantic = mixed.filter(isMessageSemanticallyRelevant);

        expect(semantic.map((m: any) => m.id)).toEqual([1, 2, 3, 7, 8]);
        expect(countUnprocessedBufferMessages(semantic, 0, 2)).toBe(3);
        expect(countUnprocessedBufferMessages(semantic, 1, 2)).toBe(2);
    });
});

describe('一键存入的原文边界', () => {
    it('默认把水位线推进到当前最后一条', () => {
        const messages = makeMsgs(30);
        expect(getOneShotTargetHighWaterMark(messages, 0)).toBe(30);
        expect(countOneShotPendingMessages(messages, messages, 0, 0)).toBe(30);
    });

    it('保留最近 10 条时，水位线停在倒数第 10 条之前', () => {
        const messages = makeMsgs(30);
        expect(getOneShotTargetHighWaterMark(messages, 10)).toBe(20);
        expect(countOneShotPendingMessages(messages, messages, 0, 10)).toBe(20);
    });

    it('边界按全部原文计算，但待处理数只统计可提取语义的内容', () => {
        const allMessages = [
            { id: 1, type: 'text', content: '旧文字' },
            { id: 2, type: 'image', content: 'data:image/png;base64,AAAA' },
            { id: 3, type: 'text', content: '保留一' },
            { id: 4, type: 'emoji', content: 'blob:emoji' },
            { id: 5, type: 'text', content: '保留三' },
        ] as any;
        const semantic = allMessages.filter(isMessageSemanticallyRelevant);

        expect(getOneShotTargetHighWaterMark(allMessages, 3)).toBe(2);
        expect(countOneShotPendingMessages(semantic, allMessages, 0, 3)).toBe(1);
    });
});
