import { beforeEach, describe, expect, it } from 'vitest';
import { DB, openDB } from './db';
import { CHAT_CLEANUP_CONFIRMATION, deleteChatHistoryCleanup, prepareChatHistoryCleanup } from './chatHistoryCleanup';
import { CONTENT_FAVORITES_INDEX_ASSET_ID, listContentFavorites, resolveContentFavorite, saveMessageContentFavorite } from './contentFavorites';

const confirmed = { reviewed: true, text: CHAT_CLEANUP_CONFIRMATION };
const seed = async (charId: string, count = 6) => {
    const ids: number[] = [];
    for (let n = 0; n < count; n++) ids.push(await DB.saveMessage({ charId, role: n % 2 ? 'assistant' : 'user', type: 'text', content: `正文 ${n}`, timestamp: 1700000000000 + n }));
    return ids;
};
beforeEach(() => localStorage.clear());

describe('聊天记录区间永久清理', () => {
    it('两次确认缺一不可，确认文字必须完全一致，取消/错误输入都不删记录', async () => {
        const ids = await seed('cleanup-confirm');
        const plan = await prepareChatHistoryCleanup('cleanup-confirm', { fromId: ids[1], toId: ids[3] });
        for (const confirmation of [{ reviewed: false, text: CHAT_CLEANUP_CONFIRMATION }, { reviewed: true, text: '' }, { reviewed: true, text: '我确定删除' }, { reviewed: true, text: CHAT_CLEANUP_CONFIRMATION + ' ' }]) {
            await expect(deleteChatHistoryCleanup(plan, confirmation)).rejects.toThrow('两次确认');
            expect(await DB.countMessagesByCharId(plan.charId)).toBe(6);
        }
    });

    it('包含起止边界，只删除当前角色私有记录，其他角色和群聊保留', async () => {
        const ids = await seed('cleanup-scope');
        const other = await DB.saveMessage({ charId: 'cleanup-other', role: 'user', type: 'text', content: '其他角色' });
        const group = await DB.saveMessage({ charId: 'cleanup-scope', groupId: 'g1', role: 'user', type: 'text', content: '群聊' });
        const last = await DB.saveMessage({ charId: 'cleanup-scope', role: 'user', type: 'text', content: '' });
        localStorage.setItem('mp_lastMsgId_cleanup-scope', String(ids[2]));
        const plan = await prepareChatHistoryCleanup('cleanup-scope', { fromId: last, toId: ids[2] });
        expect(plan.ids).toEqual([...ids.slice(2), last]);
        expect(plan.afterWaterlineCount).toBe(4);
        expect(await deleteChatHistoryCleanup(plan, confirmed)).toBe(5);
        expect((await DB.getMessagesByCharId('cleanup-scope', true)).map(message => message.id)).toEqual(ids.slice(0, 2));
        expect(await DB.getMessageById(other)).toBeTruthy();
        expect(await DB.getMessageById(group)).toBeTruthy();
        expect(localStorage.getItem('mp_lastMsgId_cleanup-scope')).toBe(String(ids[2]));
    });

    it('保留最近 N 条，确认期间新来的消息也保留', async () => {
        const ids = await seed('cleanup-retain');
        const plan = await prepareChatHistoryCleanup('cleanup-retain', { keepRecent: 2 });
        expect(plan.ids).toEqual(ids.slice(0, 4));
        const arrival = await DB.saveMessage({ charId: plan.charId, role: 'user', type: 'text', content: '确认期间新收到' });
        await deleteChatHistoryCleanup(plan, confirmed);
        expect((await DB.getMessagesByCharId(plan.charId, true)).map(message => message.id)).toEqual([...ids.slice(-2), arrival]);
        expect((await prepareChatHistoryCleanup(plan.charId, { keepRecent: 200 })).ids).toEqual([]);
    });

    it('选中原文被编辑时事务整体回滚，不留下删了一半的记录和语音', async () => {
        const ids = await seed('cleanup-edit');
        await DB.saveAssetRaw(`voice_msg_${ids[0]}`, { originalText: '语音' });
        const plan = await prepareChatHistoryCleanup('cleanup-edit', { fromId: ids[0], toId: ids[4] });
        await DB.updateMessage(ids[3], '确认期间手动编辑');
        await expect(deleteChatHistoryCleanup(plan, confirmed)).rejects.toThrow('记录已变化');
        expect(await DB.countMessagesByCharId(plan.charId)).toBe(6);
        expect(await DB.getAssetRaw(`voice_msg_${ids[0]}`)).toBeTruthy();
        expect((await DB.getMessageById(ids[3]))?.content).toBe('确认期间手动编辑');
    });

    it('有选中消息在另一窗口被删除时，保留其余全部原文并要求重新确认', async () => {
        const ids = await seed('cleanup-missing');
        const plan = await prepareChatHistoryCleanup('cleanup-missing', { fromId: ids[0], toId: ids[4] });
        await DB.deleteMessage(ids[3]);
        await expect(deleteChatHistoryCleanup(plan, confirmed)).rejects.toThrow('记录已变化');
        expect((await DB.getMessagesByCharId(plan.charId, true)).map(message => message.id)).toEqual(ids.filter(id => id !== ids[3]));
    });

    it('思维链等附属内容改变也需要重新确认', async () => {
        const ids = await seed('cleanup-metadata');
        const plan = await prepareChatHistoryCleanup('cleanup-metadata', { fromId: ids[0], toId: ids[3] });
        await DB.updateMessageMetadata(ids[2], previous => ({ ...previous, thinkingChain: '确认期间新增的思维链' }));
        await expect(deleteChatHistoryCleanup(plan, confirmed)).rejects.toThrow('记录已变化');
        expect(await DB.countMessagesByCharId(plan.charId)).toBe(6);
    });

    it('多批不连续主键清理不会跨过其他角色的消息', async () => {
        const own: number[] = [], other: number[] = [];
        for (let i = 0; i < 130; i++) {
            own.push(await DB.saveMessage({ charId: 'cleanup-interleaved', role: 'user', type: 'text', content: `本角色${i}` }));
            other.push(await DB.saveMessage({ charId: 'cleanup-interleaved-other', role: 'user', type: 'text', content: `其他角色${i}` }));
        }
        const plan = await prepareChatHistoryCleanup('cleanup-interleaved', { fromId: own[0], toId: own.at(-1)! });
        expect(await deleteChatHistoryCleanup(plan, confirmed)).toBe(130);
        expect(await DB.countMessagesByCharId(plan.charId)).toBe(0);
        expect((await DB.getMessagesByCharId('cleanup-interleaved-other', true)).map(message => message.id)).toEqual(other);
    });

    it('收藏图片保留，普通聊天语音缓存同步删除', async () => {
        await DB.deleteAsset(CONTENT_FAVORITES_INDEX_ASSET_ID);
        const id = await DB.saveMessage({ charId: 'cleanup-favorite', role: 'assistant', type: 'image', content: 'data:image/png;base64,QUJD' });
        const message = (await DB.getMessageById(id))!;
        await saveMessageContentFavorite(message, '角色');
        await DB.saveAssetRaw(`voice_msg_${id}`, { originalText: '缓存' });
        const plan = await prepareChatHistoryCleanup(message.charId, { fromId: id, toId: id });
        await deleteChatHistoryCleanup(plan, confirmed);
        expect(await DB.getAssetRaw(`voice_msg_${id}`)).toBeNull();
        const favorite = (await listContentFavorites())[0];
        const resolved = await resolveContentFavorite(favorite);
        expect('imageUrl' in resolved && resolved.imageUrl).toBe(message.content);
    });

    it('清理剧情陪伴副本后保留中央正文及其他角色，并移除悬空副本引用', async () => {
        const central = await DB.saveMessage({ charId: 'story-thread', role: 'assistant', type: 'text', content: '剧情正文', metadata: { source: 'story_theater', theaterId: 'story' } });
        const own = await DB.saveMessage({ charId: 'cleanup-mirror', role: 'assistant', type: 'text', content: '剧情正文', metadata: { source: 'story_theater_memory', theaterId: 'story', theaterCentralId: central } });
        const other = await DB.saveMessage({ charId: 'other-actor', role: 'assistant', type: 'text', content: '剧情正文' });
        await DB.updateMessageMetadata(central, () => ({ source: 'story_theater', theaterId: 'story', theaterMirrorIds: { 'cleanup-mirror': own, 'other-actor': other } }));
        await deleteChatHistoryCleanup(await prepareChatHistoryCleanup('cleanup-mirror', { fromId: own, toId: own }), confirmed);
        expect((await DB.getMessageById(central))?.metadata?.theaterMirrorIds).toEqual({ 'other-actor': other });
        expect(await DB.getMessageById(other)).toBeTruthy();
    });

    it('十万条记录可保留最近 200 条，预览只保留 ID 和指纹', async () => {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            for (let i = 0; i < 100050; i++) tx.objectStore('messages').add({ charId: 'cleanup-large', role: 'user', type: 'text', content: `记录${i}`, timestamp: 1700000000000 + i });
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
        const plan = await prepareChatHistoryCleanup('cleanup-large', { keepRecent: 200 });
        expect(plan.ids).toHaveLength(99850);
        expect(JSON.stringify(plan)).not.toContain('记录');
        expect(await deleteChatHistoryCleanup(plan, confirmed)).toBe(99850);
        const left = await DB.getMessagesByCharId('cleanup-large', true);
        expect(left).toHaveLength(200);
        expect(left[0].content).toBe('记录99850');
        expect(left.at(-1)?.content).toBe('记录100049');
    }, 120000);
});
