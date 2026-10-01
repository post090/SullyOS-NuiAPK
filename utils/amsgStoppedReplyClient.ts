import { stoppedReplyKey } from './amsgStoppedReply';

const KEY = 'amsg_stopped_reply_receipts_v1';
type Receipt = { charId: string; uuid: string; text: string };
const memory = new Map<string, Receipt>();
const pending = new Map<string, { charId: string; promise: Promise<string> }>();
function read(): Record<string, Receipt> {
    try { return { ...JSON.parse(localStorage.getItem(KEY) || '{}'), ...Object.fromEntries(memory) }; }
    catch { return Object.fromEntries(memory); }
}
function save(receipt: Receipt): void {
    const receipts = read();
    receipts[receipt.uuid] = receipt;
    memory.set(receipt.uuid, receipt);
    try { localStorage.setItem(KEY, JSON.stringify(receipts)); }
    catch (error) { console.warn('[instant-stop] 停止回执未能持久化', error); }
}

/** The next turn waits only for local DB reconciliation, never for the cancellation network request. */
export function stageStoppedReplyReceipt(charId: string, uuid: string, text: Promise<string>): Promise<string> {
    save({ charId, uuid, text: '' });
    const promise = text.then(value => {
        save({ charId, uuid, text: value });
        return value;
    }).finally(() => { pending.delete(uuid); });
    pending.set(uuid, { charId, promise });
    return promise;
}

export async function stoppedReplyStateEntries(charId: string): Promise<Array<{ key: string; value: string }>> {
    await Promise.all([...pending.values()].filter(entry => entry.charId === charId).map(entry => entry.promise));
    return Object.values(read()).filter(receipt => receipt.charId === charId)
        .map(receipt => ({ key: stoppedReplyKey(receipt.uuid), value: JSON.stringify({ text: receipt.text }) }));
}
