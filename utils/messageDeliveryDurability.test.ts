import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB, openDB } from './db';

afterEach(() => vi.restoreAllMocks());

describe('通知前必须确认消息/定时任务已提交', () => {
    it('一次队列读取找出所有到期角色和最近的未来时间，空队列没有到期角色', async () => {
        const future = Date.now() + 600_000;
        await DB.saveScheduledMessage({ id: 'plan-past', charId: 'past', content: '到了', dueAt: 1, createdAt: 1 });
        await DB.saveScheduledMessage({ id: 'plan-future', charId: 'future', content: '稍后', dueAt: future, createdAt: 1 });
        try {
            expect(await DB.getScheduledDeliveryPlan()).toEqual({ dueCharacters: new Set(['past']), nextDueAt: future });
        } finally {
            await DB.deleteScheduledMessage('plan-past');
            await DB.deleteScheduledMessage('plan-future');
        }
        expect(await DB.getScheduledDeliveryPlan()).toEqual({ dueCharacters: new Set(), nextDueAt: Infinity });
    });
    it('定时任务写入事务中止时不能报告成功', async () => {
        await openDB();
        const originalPut = IDBObjectStore.prototype.put;
        vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: any[]) {
            const request = (originalPut as any).apply(this, args) as IDBRequest;
            this.transaction.abort();
            return request;
        });
        await expect(DB.saveScheduledMessage({
            id: 'failed-schedule', charId: 'schedule-abort', content: '该出门了', dueAt: 1, createdAt: 1,
        })).rejects.toBeTruthy();
        expect(await DB.getDueScheduledMessages('schedule-abort')).toEqual([]);
    });

    it('消息 add 成功但事务随后中止时，不能让调用方发出成功通知', async () => {
        await openDB();
        const originalAdd = IDBObjectStore.prototype.add;
        vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: any[]) {
            const request = (originalAdd as any).apply(this, args) as IDBRequest;
            request.addEventListener('success', () => this.transaction.abort());
            return request;
        });
        await expect(DB.saveMessage({
            charId: 'message-abort', role: 'assistant', type: 'text', content: '晚安',
        })).rejects.toBeTruthy();
        expect(await DB.getMessagesByCharId('message-abort', true)).toEqual([]);
    });

    it('任务与消息成功提交后能读到，删除任务也等提交完成', async () => {
        await DB.saveScheduledMessage({ id: 'saved-schedule', charId: 'schedule-ok', content: '到了', dueAt: 1, createdAt: 1 });
        expect(await DB.getDueScheduledMessages('schedule-ok')).toHaveLength(1);
        const id = await DB.saveMessage({ charId: 'schedule-ok', role: 'assistant', type: 'text', content: '到了' });
        expect((await DB.getMessagesByCharId('schedule-ok', true))[0].id).toBe(id);
        await DB.deleteScheduledMessage('saved-schedule');
        expect(await DB.getDueScheduledMessages('schedule-ok')).toEqual([]);
    });
});
