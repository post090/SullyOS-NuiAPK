/** Bounded readonly cursor: settle on transaction completion, abort, close or timeout. */
export function readLocalCursor<T>(db: IDBDatabase, storeName: string, options: {
    index?: string; query?: IDBValidKey | IDBKeyRange; direction?: IDBCursorDirection;
    limit?: number; accept?: (value: any) => boolean; map?: (value: any) => T;
    timeoutMs?: number;
} = {}): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const rows: T[] = [];
        let settled = false;
        const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            db.removeEventListener('close', onClose);
            if (error) reject(error); else resolve(rows);
        };
        const fail = (error: unknown) => {
            finish(error);
            // Only cancel this reader. Never clear stores, abort writers or close other apps' connections.
            try { tx.abort(); } catch { /* already completed/aborted */ }
        };
        const onClose = () => fail(new Error('本地数据库连接中断，请重新打开应用后重试'));
        const timer = setTimeout(() => fail(new Error('本地数据读取超时，请重试；无需清理数据')), options.timeoutMs ?? 20_000);
        db.addEventListener('close', onClose);
        tx.oncomplete = () => finish();
        tx.onerror = tx.onabort = () => finish(tx.error || new Error('本地数据读取中断'));
        try {
            const store = tx.objectStore(storeName);
            const source = options.index ? store.index(options.index) : store;
            const request = source.openCursor(options.query, options.direction);
            request.onerror = () => fail(request.error || new Error('本地数据读取失败'));
            request.onsuccess = () => {
                if (settled) return;
                try {
                    const cursor = request.result;
                    if (!cursor || rows.length >= (options.limit ?? Infinity)) return;
                    const value = cursor.value;
                    if (!options.accept || options.accept(value)) rows.push(options.map ? options.map(value) : value);
                    if (rows.length < (options.limit ?? Infinity)) cursor.continue();
                } catch (error) { fail(error); }
            };
        } catch (error) { fail(error); }
    });
}
