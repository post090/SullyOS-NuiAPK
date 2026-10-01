import { expect, it } from 'vitest';
import { stageStoppedReplyReceipt, stoppedReplyStateEntries } from './amsgStoppedReplyClient';
import { stoppedReplyKey } from './amsgStoppedReply';

it('下一轮等待本地保留正文确定后才打包，避免角色记住被丢弃的全文', async () => {
    let finish!: (text: string) => void;
    const reconciliation = stageStoppedReplyReceipt('receipt-char', 'receipt-round', new Promise(resolve => { finish = resolve; }));
    let packed = false;
    const nextTurn = stoppedReplyStateEntries('receipt-char').then(rows => { packed = true; return rows; });
    await Promise.resolve();
    expect(packed).toBe(false);
    expect(await stoppedReplyStateEntries('unrelated-char')).toEqual([]);
    finish('实际显示到这里');
    await reconciliation;
    expect(await nextTurn).toContainEqual({ key: stoppedReplyKey('receipt-round'), value: JSON.stringify({ text: '实际显示到这里' }) });
});
