import { describe, expect, it, vi } from 'vitest';
import { DB, openDB } from '../db';
import { loadCharacterContextMessageIds, loadCharacterContextMessages } from '../chatContextRange';
import type { CharacterProfile } from '../../types';

describe('彼方动态轻量读取', () => {
    it('限量前排除群聊、用户留言，保留已归档动态；默认调用仍读取全部', async () => {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            for (let i = 1; i <= 85; i++) tx.objectStore('messages').add({
                charId: 'vr-feed-limit', type: 'vr_card', content: String(i), timestamp: i,
                metadata: { vrCard: true, userBoardPost: i > 60 }, groupId: i === 60 ? 'group' : undefined,
            });
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
        const cards = await DB.getVRCardsByCharId('vr-feed-limit', 50, message => !message.metadata?.userBoardPost);
        expect(cards).toHaveLength(50);
        expect(cards[0].content).toBe('59');
        expect(cards.at(-1)?.content).toBe('10');
        expect(await DB.getVRCardsByCharId('vr-feed-limit')).toHaveLength(84);
    });

    it('手动与自适应可见性和原上下文一致，删除/过期断点不错误隐藏动态', async () => {
        const db = await openDB();
        const ids: number[] = [];
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            for (let i = 0; i < 25; i++) {
                const req = tx.objectStore('messages').add({ charId: 'vr-feed-context', type: 'text', content: 'large'.repeat(2000), timestamp: i, groupId: i === 23 ? 'group' : undefined });
                req.onsuccess = () => ids.push(Number(req.result));
            }
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
        const candidates = ids.filter((_, i) => i !== 23).map(id => ({ id }));
        localStorage.setItem('mp_lastMsgId_vr-feed-context', String(ids[5]));
        for (const adaptive of [false, true]) {
            for (const breakpoint of [undefined, ids[2], ids[20], ids[23], ids[24] + 100]) {
                const char = { id: 'vr-feed-context', contextLimit: 10, contextRangeMode: adaptive ? 'adaptive' : 'manual', autoArchiveEnabled: adaptive, contextUserStartMessageId: breakpoint } as CharacterProfile;
                const expected = (await loadCharacterContextMessages(char)).map(message => message.id);
                const fullRead = vi.spyOn(DB, 'getMessagesFromId');
                const result = await loadCharacterContextMessageIds(char, candidates);
                expect([...result]).toEqual(expected);
                expect(fullRead).not.toHaveBeenCalled();
                fullRead.mockRestore();
            }
        }
        const refs = await DB.getPrivateMessageRefs('vr-feed-context', 10);
        expect(refs).toHaveLength(10);
        expect(refs.every(ref => !('content' in ref))).toBe(true);
    });
});
