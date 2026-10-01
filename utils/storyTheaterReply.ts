import type { CharacterProfile, Message } from '../types';
import { openDB } from './db';
import { loadCharacterContextMessages } from './chatContextRange';

/** 本剧情原文已有独立历史槽位，角色镜像不得重复注入或带回待重写回复。 */
export async function loadStoryActorContext(char: CharacterProfile, theaterId: string, limit: number): Promise<Message[]> {
    if (limit <= 0) return [];
    const messages = await loadCharacterContextMessages(char);
    return messages.filter(message => !(message.metadata?.source === 'story_theater_memory' && message.metadata?.theaterId === theaterId)).slice(-limit);
}

export const STORY_REROLL_INSTRUCTION = '本轮是重新生成：从同一处故事落点重新写这一轮，换一个合理的切入角度、对白和细节展开；保留已确立的事实和用户输入，不把这次操作写进故事，不把尚未发生的旧版本当作既定经历。';

/** 成功后一次事务替换正文和镜像；失败/并发编辑时保留原文，不先删后写。 */
export async function replaceStoryTheaterReply(original: Message, content: string, metadata: Record<string, unknown>): Promise<void> {
    const mirrorIds = Object.values((original.metadata?.theaterMirrorIds || {}) as Record<string, number>).map(Number).filter(id => Number.isFinite(id) && id > 0);
    const ids = [...new Set([original.id, ...mirrorIds])];
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('messages', 'readwrite');
        const store = transaction.objectStore('messages');
        let failure: Error | undefined;
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(failure || transaction.error || new Error('重写保存失败，原回复已保留'));
        for (const id of ids) {
            const request = store.get(id);
            request.onsuccess = () => {
                const current = request.result as Message | undefined;
                if (!current || current.content !== original.content) {
                    failure = new Error('这条回复已被修改或删除，请刷新后重试');
                    transaction.abort();
                    return;
                }
                store.put({ ...current, content, ...(id === original.id ? { metadata: { ...current.metadata, ...metadata } } : {}) });
            };
        }
    });
}
