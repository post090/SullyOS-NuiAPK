import { describe, it, expect, vi } from 'vitest';
import { DB } from './db';
import { loadCharacterContextRange } from './chatContextRange';
import type { CharacterProfile } from '../types';
import { getReliableMemoryPalaceHighWaterMark, setReliableMemoryPalaceHighWaterMark } from './memoryPalace/highWaterMark';

// 记忆宫殿水位线自愈：浏览器清掉 IndexedDB（消息自增 id 归零重计）但 localStorage
// 幸存时，残留的 mp_lastMsgId_ 高水位会把该角色所有新消息（含刚发的那条）从
// hwm 过滤读取里挡掉 —— 请求只剩 system 消息、上游 400。不变式：合法水位是某条
// 既有消息的 id，新消息的自增 id 必然大于它；出现新 id ≤ 水位即证明水位失效。
describe('saveMessage 记忆宫殿水位线自愈', () => {
    it('正常新消息不改变合法镜像，且只读取水位之后的新消息', async () => {
        const profile = { id: 'normal-new-hwm', contextRangeMode: 'adaptive', autoArchiveEnabled: true } as CharacterProfile;
        const oldId = await DB.saveMessage({ charId: profile.id, role: 'assistant', type: 'text', content: '旧回复' });
        await setReliableMemoryPalaceHighWaterMark(profile.id, oldId);
        const mirror = await DB.getAssetRaw(`mp_hwm_v1_${profile.id}`);
        const newId = await DB.saveMessage({ charId: profile.id, role: 'user', type: 'text', content: '新消息' });
        expect(await DB.getAssetRaw(`mp_hwm_v1_${profile.id}`)).toEqual(mirror);
        expect(await getReliableMemoryPalaceHighWaterMark(profile.id)).toBe(oldId);
        expect((await loadCharacterContextRange(profile)).messages.map(m => m.id)).toEqual([newId]);
    });

    it('清理失效镜像后，后台重读不会再次隐藏刚保存的消息', async () => {
        const profile = { id: 'new-message-stale-mirror', contextRangeMode: 'adaptive', autoArchiveEnabled: true } as CharacterProfile;
        await setReliableMemoryPalaceHighWaterMark(profile.id, 99999);
        const id = await DB.saveMessage({ charId: profile.id, role: 'user', type: 'text', content: '新消息' });
        await getReliableMemoryPalaceHighWaterMark(profile.id);
        expect((await loadCharacterContextRange(profile)).messages.map(m => m.id)).toContain(id);
    });

    it.each([false, true])('事务中止时消息和镜像一起回滚，本地水位不动（推送=%s）', async (push) => {
        const charId = `hwm-abort-${push}`;
        const mirrorKey = `mp_hwm_v1_${charId}`;
        await setReliableMemoryPalaceHighWaterMark(charId, 99999);
        const mirror = await DB.getAssetRaw(mirrorKey);
        const originalDelete = IDBObjectStore.prototype.delete;
        const spy = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key) {
            const request = originalDelete.call(this, key);
            if (this.name === 'assets' && key === mirrorKey) this.transaction.abort();
            return request;
        });
        try {
            const message = { charId, role: 'user', type: 'text', content: '不能提交' } as const;
            // fake-indexeddb 的主动 abort 可先用 null error 拒绝；这里验证不允许成功提交。
            await expect(push ? DB.saveMessageOnce('abort-delivery', message) : DB.saveMessage(message)).rejects.not.toBeUndefined();
        } finally { spy.mockRestore(); }
        expect(await DB.getMessagesByCharId(charId, true)).toEqual([]);
        expect(await DB.getAssetRaw(mirrorKey)).toEqual(mirror);
        expect(localStorage.getItem(`mp_lastMsgId_${charId}`)).toBe('99999');
    });

    it('删除最新的已归档消息不会降低水位，其他角色写入也不会改它', async () => {
        const charId = 'hwm-deleted-latest';
        const id = await DB.saveMessage({ charId, role: 'user', type: 'text', content: '已归档' });
        await setReliableMemoryPalaceHighWaterMark(charId, id);
        await DB.deleteMessage(id);
        await DB.saveMessage({ charId: 'hwm-other-character', role: 'user', type: 'text', content: '其他角色' });
        expect(await getReliableMemoryPalaceHighWaterMark(charId)).toBe(id);
        await DB.saveMessage({ charId, role: 'user', type: 'text', content: '新消息' });
        expect(await getReliableMemoryPalaceHighWaterMark(charId)).toBe(id);
    });

    it('推送首次落库清理只有镜像中的失效水位，重复投递不清理合法水位', async () => {
        const charId = 'push-stale-mirror';
        await DB.saveAssetRaw(`mp_hwm_v1_${charId}`, { msgId: 99999 });
        const payload = { charId, role: 'assistant', type: 'text', content: '推送' } as const;
        const id = await DB.saveMessageOnce('delivery-stale', payload);
        expect(await DB.getAssetRaw(`mp_hwm_v1_${charId}`)).toBeNull();
        expect(await getReliableMemoryPalaceHighWaterMark(charId)).toBe(0);
        await setReliableMemoryPalaceHighWaterMark(charId, id);
        expect(await DB.saveMessageOnce('delivery-stale', payload)).toBe(id);
        expect(await getReliableMemoryPalaceHighWaterMark(charId)).toBe(id);
    });

    it('后台校准和新消息并发时，失效镜像不会重新污染本地水位', async () => {
        for (const readFirst of [true, false]) {
            const charId = `concurrent-hwm-${readFirst}`;
            await setReliableMemoryPalaceHighWaterMark(charId, 99999);
            const read = () => getReliableMemoryPalaceHighWaterMark(charId);
            const write = () => DB.saveMessage({ charId, role: 'user', type: 'text', content: '新消息' });
            await Promise.all(readFirst ? [read(), write()] : [write(), read()]);
            expect(await getReliableMemoryPalaceHighWaterMark(charId)).toBe(0);
            expect((await DB.getRecentMessagesByCharId(charId, 10)).map(m => m.content)).toContain('新消息');
        }
    });

    it('残留高水位 ≥ 新消息 id → 落库时自动移除，该消息能被默认读取到', async () => {
        localStorage.setItem('mp_lastMsgId_char-stale', '99999');
        const id = await DB.saveMessage({ charId: 'char-stale', role: 'user', type: 'text', content: '你好' } as any);
        expect(id).toBeLessThan(99999);
        expect(localStorage.getItem('mp_lastMsgId_char-stale')).toBeNull();
        // 水位清掉后，默认（hwm 过滤）读取要能看到这条消息 —— 之前 400 的根因就是这里读出空数组
        const msgs = await DB.getRecentMessagesByCharId('char-stale', 10);
        expect(msgs.map(m => m.content)).toContain('你好');
    });

    it('正常水位（小于新消息 id）原样保留', async () => {
        localStorage.setItem('mp_lastMsgId_char-ok', '1');
        const id = await DB.saveMessage({ charId: 'char-ok', role: 'user', type: 'text', content: 'hi' } as any);
        expect(id).toBeGreaterThan(1);
        expect(localStorage.getItem('mp_lastMsgId_char-ok')).toBe('1');
    });

    it('群聊消息同时校验并清理失效的群水位键', async () => {
        localStorage.setItem('mp_lastMsgId_group_g1', '99999');
        await DB.saveMessage({ charId: 'char-x', groupId: 'g1', role: 'user', type: 'text', content: 'g' } as any);
        expect(localStorage.getItem('mp_lastMsgId_group_g1')).toBeNull();
    });
});
