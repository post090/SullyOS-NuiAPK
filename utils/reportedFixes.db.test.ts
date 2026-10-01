import { describe, it, expect } from 'vitest';
import { DB } from './db';
import type { DailySchedule } from '../types';

describe('日程头图跨日保留', () => {
    it('uses the newest uploaded cover and retains it on regeneration and rollover', async () => {
        const schedule = (date: string, coverImage?: string): DailySchedule => ({ id: `cover-test_${date}`, charId: 'cover-test', date, slots: [], generatedAt: Date.now(), coverImage });
        await DB.saveDailySchedule(schedule('2026-09-29', 'old-image'));
        await DB.saveDailySchedule(schedule('2026-09-30', 'new-image'));
        expect(await DB.getScheduleCoverImage('cover-test')).toBe('new-image');
        await DB.saveDailySchedule(schedule('2026-09-30'));
        await DB.saveDailySchedule(schedule('2026-10-01'));
        expect((await DB.getDailySchedule('cover-test', '2026-10-01'))?.coverImage).toBe('new-image');
    });
});

describe('留言墙编辑与删除', () => {
    it('edits both authors and preserves a simultaneous append', async () => {
        const message = (id: string, authorId: string) => ({ id, authorId, authorName: authorId, content: '原文', createdAt: 1 });
        await DB.saveVRGuestbook({ id: 'board', messages: [message('edit-user', 'user'), message('edit-char', 'char')], updatedAt: 1 });
        await Promise.all([
            DB.editVRGuestbookMessage('edit-user', '改过的用户留言'),
            DB.appendVRGuestbookMessages([message('new-post', 'other')]),
            DB.editVRGuestbookMessage('edit-char', '改过的角色留言'),
        ]);
        const board = await DB.getVRGuestbook();
        expect(board?.messages.map(m => m.content)).toEqual(['改过的用户留言', '改过的角色留言', '原文']);
        await DB.editVRGuestbookMessage('edit-user', null);
        await DB.editVRGuestbookMessage('edit-char', null);
        expect((await DB.getVRGuestbook())?.messages.map(m => m.id)).toEqual(['new-post']);
    });
});
