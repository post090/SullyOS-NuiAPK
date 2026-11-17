import { describe, expect, it } from 'vitest';
import { CharHomeProfile } from '../types';
import { applyHomeLifeEvent } from './homeOps';
import { normalizeHomeExpiryDate } from './assetGen';

const NOW = new Date(2026, 10, 18, 12, 0, 0).getTime();
const options = { source: 'chat' as const, now: NOW };

function oldProfile(): CharHomeProfile {
    return {
        charId: 'char-home', generatedAt: NOW - 1000, homeName: '旧档案住所',
        rooms: [
            { id: 'kitchen', name: '厨房', items: [{ id: 'milk', name: '牛奶', expiryDate: '2026-01-01' }] },
            { id: 'living', name: '客厅', items: [{ id: 'chair', name: '旧椅子' }] },
        ],
        supplies: [{ id: 'paper', name: '纸巾', level: 'low' }],
    };
}

describe('normalizeHomeExpiryDate', () => {
    it('只接受真实且尚未过去的日期', () => {
        expect(normalizeHomeExpiryDate('2026-11-18', NOW)).toBe('2026-11-18');
        expect(normalizeHomeExpiryDate('2026-11-25', NOW)).toBe('2026-11-25');
        expect(normalizeHomeExpiryDate('2026-11-17', NOW)).toBeNull();
        expect(normalizeHomeExpiryDate('2026-02-30', NOW)).toBeNull();
        expect(normalizeHomeExpiryDate('11/25/2026', NOW)).toBeNull();
    });
});

describe('applyHomeLifeEvent', () => {
    it('购买耐用品会新增到指定房间，且不改动补给', () => {
        const profile = oldProfile();
        const result = applyHomeLifeEvent(profile, {
            type: 'buy', name: '咖啡机', roomName: '厨房', kind: 'durable',
        }, options);

        expect(result.changed).toBe(true);
        const kitchen = result.profile.rooms.find(room => room.name === '厨房')!;
        expect(kitchen.items).toHaveLength(2);
        expect(kitchen.items[1]).toMatchObject({ name: '咖啡机', kind: 'durable', updatedAt: NOW });
        expect(result.profile.supplies).toEqual(profile.supplies);
        expect(result.profile.recentEvents?.[0]).toMatchObject({ type: 'buy', name: '咖啡机', source: 'chat' });
        expect(profile.rooms[0].items).toHaveLength(1); // 不原地修改旧快照
    });

    it('购买消耗品记录有效保质期，非法或过去日期不会落账', () => {
        const bought = applyHomeLifeEvent(oldProfile(), {
            type: 'buy', name: '鲜牛奶', roomName: '厨房', kind: 'consumable', expiryDate: '2026-11-25',
        }, options);
        expect(bought.profile.rooms[0].items[1]).toMatchObject({
            name: '鲜牛奶', kind: 'consumable', expiryDate: '2026-11-25',
        });

        const profile = oldProfile();
        const invalid = applyHomeLifeEvent(profile, {
            type: 'buy', name: '坏日期牛奶', roomName: '厨房', kind: 'consumable', expiryDate: '2026-02-30',
        }, options);
        expect(invalid.changed).toBe(false);
        expect(invalid.profile).toBe(profile);
        expect(invalid.profile.recentEvents).toBeUndefined();
    });

    it('旧档案的过期消耗品可直接补货并换成新保质期', () => {
        const profile = oldProfile();
        const result = applyHomeLifeEvent(profile, {
            type: 'restock', name: '牛奶', expiryDate: '2026-11-30',
        }, options);

        expect(result.changed).toBe(true);
        expect(result.profile.rooms[0].items[0]).toMatchObject({
            id: 'milk', kind: 'consumable', expiryDate: '2026-11-30', note: '刚补过货',
        });
        expect(profile.rooms[0].items[0].kind).toBeUndefined();
        expect(profile.rooms[0].items[0].expiryDate).toBe('2026-01-01');
    });

    it('补货没填新日期时清除旧保质期，不让过期天数继续增长', () => {
        const result = applyHomeLifeEvent(oldProfile(), { type: 'restock', name: '牛奶' }, options);
        expect(result.changed).toBe(true);
        expect(result.profile.rooms[0].items[0].expiryDate).toBeUndefined();
        expect(result.profile.rooms[0].items[0].note).toContain('未记录新保质期');
    });

    it('已有补给补回充足，没有对应补给时新增', () => {
        const restocked = applyHomeLifeEvent(oldProfile(), { type: 'restock', name: '纸巾' }, options);
        expect(restocked.profile.supplies[0]).toMatchObject({ name: '纸巾', level: 'plenty', note: '刚补过货' });

        const added = applyHomeLifeEvent(oldProfile(), { type: 'restock', name: '洗衣液' }, options);
        expect(added.profile.supplies).toHaveLength(2);
        expect(added.profile.supplies[1]).toMatchObject({ name: '洗衣液', level: 'plenty' });
    });

    it('吃完消耗品会移除物品，消耗补给会逐档下降', () => {
        const consumed = applyHomeLifeEvent(oldProfile(), { type: 'consume', name: '牛奶' }, options);
        expect(consumed.changed).toBe(true);
        expect(consumed.profile.rooms[0].items).toHaveLength(0);

        const once = applyHomeLifeEvent(oldProfile(), { type: 'consume', name: '纸巾' }, options);
        expect(once.profile.supplies[0].level).toBe('out');
        const twice = applyHomeLifeEvent(once.profile, { type: 'consume', name: '纸巾' }, options);
        expect(twice.changed).toBe(false);
        expect(twice.profile.supplies[0].level).toBe('out');
    });

    it('丢弃可移除耐用品；找不到目标时不伪造更新记录', () => {
        const discarded = applyHomeLifeEvent(oldProfile(), { type: 'discard', name: '旧椅子' }, options);
        expect(discarded.changed).toBe(true);
        expect(discarded.profile.rooms[1].items).toHaveLength(0);

        const profile = oldProfile();
        const missing = applyHomeLifeEvent(profile, { type: 'consume', name: '不存在的蛋糕' }, options);
        expect(missing.changed).toBe(false);
        expect(missing.profile).toBe(profile);
        expect(missing.profile.recentEvents).toBeUndefined();
    });

    it('同一消息重放时按事件 ID 去重', () => {
        const input = { type: 'buy' as const, name: '咖啡机', roomName: '厨房', kind: 'durable' as const };
        const eventOptions = { ...options, eventId: 'message-1:HOME:BUY:咖啡机' };
        const first = applyHomeLifeEvent(oldProfile(), input, eventOptions);
        const replay = applyHomeLifeEvent(first.profile, input, eventOptions);

        expect(first.changed).toBe(true);
        expect(replay.changed).toBe(false);
        expect(replay.profile).toBe(first.profile);
        expect(replay.profile.rooms[0].items.filter(item => item.name === '咖啡机')).toHaveLength(1);
        expect(replay.profile.recentEvents).toHaveLength(1);
    });
});
