import type { Message } from '../../types';
import { openDB } from '../db';
import { normalizeRangeSearchText } from './rangeSelection';

export interface RangeMessagePage {
    messages: Message[];
    hasMore: boolean;
}

const readableContent = (message: Message): string => {
    if (message.type === 'image') return '[图片]';
    if (message.type === 'emoji') return '[表情]';
    const text = typeof message.content === 'string' ? message.content : '';
    if (text.startsWith('data:')) return '[媒体]';
    return text;
};

export const formatRangeTimestamp = (timestamp: number): string => timestamp
    ? new Date(timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

/** 游标只保留一页短预览；空搜索不建立全文索引，翻旧页直接跳到边界。 */
export async function loadRangeMessagePage(charId: string, options: {
    beforeId?: number;
    afterId?: number;
    query?: string;
    limit?: number;
    includeEmpty?: boolean;
    signal?: AbortSignal;
} = {}): Promise<RangeMessagePage> {
    const db = await openDB();
    const limit = Math.max(1, Math.min(100, options.limit || 50));
    const query = normalizeRangeSearchText(options.query || '');
    const forward = options.afterId !== undefined;
    const boundary = forward ? options.afterId : options.beforeId;
    if (options.signal?.aborted) throw new DOMException('已取消', 'AbortError');
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('messages', 'readonly');
        const request = transaction.objectStore('messages').index('charId').openCursor(IDBKeyRange.only(charId), forward ? 'next' : 'prev');
        const messages: Message[] = [];
        let hasMore = false;
        const abort = () => { try { transaction.abort(); } catch {} };
        options.signal?.addEventListener('abort', abort, { once: true });
        const cleanup = () => options.signal?.removeEventListener('abort', abort);
        transaction.oncomplete = () => { cleanup(); resolve({ messages: messages.sort((a, b) => a.id - b.id), hasMore }); };
        transaction.onerror = () => { cleanup(); reject(transaction.error); };
        transaction.onabort = () => { cleanup(); reject(new DOMException('已取消', 'AbortError')); };
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const id = Number(cursor.primaryKey);
            if (boundary !== undefined && (forward ? id <= boundary : id >= boundary)) {
                if (forward ? id < boundary : id > boundary) cursor.continuePrimaryKey(charId, boundary);
                else cursor.continue();
                return;
            }
            const message = cursor.value as Message;
            if (!message.groupId) {
                const rawContent = readableContent(message);
                const content = rawContent.trim() || !options.includeEmpty ? rawContent : '[空消息]';
                if (content.trim() && (!query || normalizeRangeSearchText(`${content} ${formatRangeTimestamp(message.timestamp)}`).includes(query))) {
                    if (messages.length === limit) { hasMore = true; return; }
                    // 不把附件、metadata、完整正文留在 React 状态里。
                    messages.push({ id: message.id, charId, role: message.role, type: message.type, timestamp: message.timestamp, content: content.slice(0, 160), metadata: { source: message.metadata?.source } });
                }
            }
            cursor.continue();
        };
    });
}

/** 选区只加载范围内正文，手动总结不再先读取该角色全部历史。 */
export async function loadRangeMessageContents(charId: string, fromId: number, toId: number): Promise<Message[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const request = db.transaction('messages', 'readonly').objectStore('messages').openCursor(IDBKeyRange.bound(Math.min(fromId, toId), Math.max(fromId, toId)));
        const messages: Message[] = [];
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) { resolve(messages); return; }
            const message = cursor.value as Message;
            if (message.charId === charId && !message.groupId) messages.push(message);
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    });
}
