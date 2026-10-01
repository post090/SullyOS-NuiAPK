import type { AmsgSelfLog } from './amsgFirePack';

export const stoppedReplyKey = (uuid: string): string => `chat_stop:${uuid}`;

/** Separate per-round receipts also cover a worker finishing its log write after cancellation. */
export function reconcileStoppedReplies(log: AmsgSelfLog | null, rows: Array<{ key: string; value: string }>): AmsgSelfLog | null {
    if (!log) return log;
    const kept = new Map<string, string>();
    for (const row of rows) {
        if (!row.key.startsWith('chat_stop:')) continue;
        try {
            const value = JSON.parse(row.value);
            if (typeof value.text === 'string') kept.set(row.key.slice('chat_stop:'.length), value.text);
        } catch { /* Invalid state cannot delete unrelated history. */ }
    }
    return { ...log, entries: log.entries.flatMap(entry => {
        if (!entry.taskUuid || !kept.has(entry.taskUuid)) return [entry];
        const text = kept.get(entry.taskUuid)!;
        return text ? [{ ...entry, text }] : [];
    }) };
}
