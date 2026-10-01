import { describe, expect, it } from 'vitest';
import { DB } from './db';

describe('见面历史游标分页', () => {
  it('跨场次和旧记录按 50 条读取，排除聊天、群聊与其他角色，游标删除后仍能续读', async () => {
    const charId = 'date-paging';
    const ids: number[] = [];
    for (let i = 0; i < 121; i++) {
      ids.push(await DB.saveMessage({ charId, role: 'assistant', type: 'text', content: String(i),
        metadata: { source: 'date', ...(i >= 30 ? { dateEncounterId: i < 80 ? 'old' : 'new' } : {}) } }));
      if (i % 10 === 0) {
        await DB.saveMessage({ charId, role: 'user', type: 'text', content: '普通聊天' });
        await DB.saveMessage({ charId, groupId: 'group', role: 'user', type: 'text', content: '群聊', metadata: { source: 'date' } });
      }
    }
    await DB.saveMessage({ charId: 'someone-else', role: 'user', type: 'text', content: '另一人', metadata: { source: 'date' } });
    const latest = await DB.getRecentMessagesByCharIdAndSource(charId, 'date', 51);
    expect(latest.map(row => row.id)).toEqual(ids.slice(-51));
    const first = latest.slice(-50)[0].id;
    await DB.deleteMessage(first);
    const older = await DB.getRecentMessagesByCharIdAndSource(charId, 'date', 51, first);
    expect(older.map(row => row.id)).toEqual(ids.slice(20, 71));
    const oldest = await DB.getRecentMessagesByCharIdAndSource(charId, 'date', 51, older.slice(-50)[0].id);
    expect(oldest.map(row => row.id)).toEqual(ids.slice(0, 21));
    expect(await DB.getRecentMessagesByCharIdAndSource(charId, 'date', 51, ids[0])).toEqual([]);
  });
});
