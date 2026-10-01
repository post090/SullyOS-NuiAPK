import { expect, it } from 'vitest';
import { reconcileStoppedReplies, stoppedReplyKey } from './amsgStoppedReply';
it('停止后的云端自述只保留用户收到的正文，其他轮不变', () => {
    const log = { entries: [{ id: 'a', taskUuid: 'one', text: '全文' }, { id: 'b', taskUuid: 'two', text: '另一轮' }], tasks: [] } as any;
    const rows = [{ key: stoppedReplyKey('one'), value: JSON.stringify({ text: '已显示' }) }];
    expect(reconcileStoppedReplies(log, rows)?.entries.map(e => e.text)).toEqual(['已显示', '另一轮']);
    expect(log.entries[0].text).toBe('全文');
    expect(reconcileStoppedReplies(log, [{ ...rows[0], value: '{"text":""}' }])?.entries.map(e => e.id)).toEqual(['b']);
});
