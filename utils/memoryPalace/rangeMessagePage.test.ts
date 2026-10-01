import { describe, expect, it } from 'vitest';
import { DB, openDB } from '../db';
import { loadRangeMessageContents, loadRangeMessagePage } from './rangeMessagePage';

describe('手动总结按页读取', () => {
    it('十万条记录只返回一页短预览，前后翻页没有重复或遗漏', async () => {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            const store = tx.objectStore('messages');
            for (let i = 0; i < 100050; i++) store.add({ charId: 'range-large', role: 'user', type: 'text', content: `记录${i}`, timestamp: 1700000000000 + i });
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
        const latest = await loadRangeMessagePage('range-large');
        expect(latest.messages).toHaveLength(50);
        expect(latest.messages[0].content).toBe('记录100000');
        expect(latest.hasMore).toBe(true);
        const older = await loadRangeMessagePage('range-large', { beforeId: latest.messages[0].id });
        expect(older.messages.at(-1)?.content).toBe('记录99999');
        const newer = await loadRangeMessagePage('range-large', { afterId: older.messages.at(-1)!.id });
        expect(newer.messages).toEqual(latest.messages);
        expect(newer.hasMore).toBe(false);
    // 十万条记录在 fake-indexeddb 上单跑就要 ~24s，全量并行时机器负载更高；
    // 时间预算给足，断言与负载规模不变。
    }, 180_000);
    it('全文/日期搜索按需匹配，预览不保留长正文和媒体，选区可跨过其他角色消息', async () => {
        const first = await DB.saveMessage({ charId: 'range-search', role: 'user', type: 'text', content: '长'.repeat(200) + '生日', timestamp: new Date(2026, 5, 22).getTime() });
        await DB.saveMessage({ charId: 'range-other', role: 'user', type: 'text', content: '别人的正文' });
        const last = await DB.saveMessage({ charId: 'range-search', role: 'assistant', type: 'image', content: 'data:image/png;base64,' + 'A'.repeat(100000) });
        const found = await loadRangeMessagePage('range-search', { query: '生日' });
        expect(found.messages.map(message => message.id)).toEqual([first]);
        expect(found.messages[0].content.length).toBeLessThanOrEqual(160);
        expect((await loadRangeMessagePage('range-search', { query: '6/22' })).messages[0].id).toBe(first);
        const page = await loadRangeMessagePage('range-search');
        expect(page.messages.at(-1)?.content).toBe('[图片]');
        const contents = await loadRangeMessageContents('range-search', first, last);
        expect(contents.map(message => message.id)).toEqual([first, last]);
        expect(contents[0].content).toContain('生日');
    });
    it('关闭面板或更换查询可以取消读取', async () => {
        const controller = new AbortController(); controller.abort();
        await expect(loadRangeMessagePage('range-large', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('清理入口可选中空消息，手动总结仍跳过空消息', async () => {
        const empty = await DB.saveMessage({ charId: 'range-empty', role: 'user', type: 'text', content: '' });
        const text = await DB.saveMessage({ charId: 'range-empty', role: 'assistant', type: 'text', content: '正文' });
        expect((await loadRangeMessagePage('range-empty')).messages.map(message => message.id)).toEqual([text]);
        const cleanup = await loadRangeMessagePage('range-empty', { includeEmpty: true });
        expect(cleanup.messages.map(message => message.id)).toEqual([empty, text]);
        expect(cleanup.messages[0].content).toBe('[空消息]');
    });
});
