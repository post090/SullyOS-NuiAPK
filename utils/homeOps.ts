/**
 * 栖居 · 生活事件落账
 *
 * 住所不再靠定期重生成来“追平”生活，而是只响应已经发生的事实：
 * 购买耐用品、购买/补货消耗品、吃完用完、丢弃。聊天指令和手动修正共用这里，
 * 旧档案没有 kind / updatedAt / recentEvents 也能直接使用。
 */

import { CharHomeProfile, HomeItem, HomeLifeEventRecord, HomeRoom, HomeSupplyLevel } from '../types';
import { buildHomeIntuition, normalizeHomeExpiryDate } from './assetGen';
import { DB } from './db';

export type HomeLifeEventInput =
    | { type: 'buy'; name: string; roomName?: string; kind?: 'durable' | 'consumable'; expiryDate?: string }
    | { type: 'restock'; name: string; roomName?: string; expiryDate?: string }
    | { type: 'consume' | 'discard'; name: string };

export interface HomeLifeEventOptions {
    source: 'chat' | 'manual';
    now?: number;
    /** 同一消息重放时保持稳定；完全相同的事件不会执行两次。 */
    eventId?: string;
}

export interface HomeLifeEventResult {
    profile: CharHomeProfile;
    changed: boolean;
    summary: string;
}

const cleanName = (value: string | undefined) => (value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
const matchKey = (value: string) => cleanName(value).toLocaleLowerCase().replace(/\s/g, '');
const isConsumable = (item: HomeItem) => item.kind === 'consumable' || !!item.expiryDate;
const newId = (prefix: string, now: number) => `${prefix}-${now}-${Math.random().toString(36).slice(2, 8)}`;

function cloneProfile(profile: CharHomeProfile): CharHomeProfile {
    return {
        ...profile,
        rooms: profile.rooms.map(room => ({ ...room, items: room.items.map(item => ({ ...item })) })),
        supplies: profile.supplies.map(supply => ({ ...supply })),
        recentEvents: [...(profile.recentEvents || [])],
    };
}

/** 纯状态转换：找不到目标或输入无效时不写库，也不伪造一条“已更新”。 */
export function applyHomeLifeEvent(
    profile: CharHomeProfile,
    input: HomeLifeEventInput,
    options: HomeLifeEventOptions,
): HomeLifeEventResult {
    const now = options.now ?? Date.now();
    const name = cleanName(input.name);
    const unchanged = (summary: string): HomeLifeEventResult => ({ profile, changed: false, summary });
    if (!name) return unchanged('请填写物品或补给名称');

    const fallbackId = `${input.type}:${now}:${matchKey(name)}:${'expiryDate' in input ? input.expiryDate || '' : ''}`;
    const eventId = options.eventId?.trim() || fallbackId;
    if ((profile.recentEvents || []).some(event => event.id === eventId)) {
        return unchanged('这条生活事件已经记录过了');
    }

    const rawExpiry = 'expiryDate' in input ? (input.expiryDate || '').trim() : '';
    const normalizedExpiry = rawExpiry ? normalizeHomeExpiryDate(rawExpiry, now) : null;
    if (rawExpiry && !normalizedExpiry) return unchanged('保质期需是今天或之后的真实日期');
    const expiryDate = normalizedExpiry || undefined;

    const next = cloneProfile(profile);
    let summary = '';

    if (input.type === 'buy') {
        const roomName = cleanName(input.roomName) || '其他';
        const kind = input.kind === 'consumable' || expiryDate ? 'consumable' : 'durable';
        let room = next.rooms.find(candidate => matchKey(candidate.name) === matchKey(roomName));
        if (!room) {
            room = { id: newId('hr', now), name: roomName, icon: '🚪', items: [] };
            next.rooms.push(room);
        }
        const existing = room.items.find(item => matchKey(item.name) === matchKey(name));
        if (existing) {
            existing.kind = kind;
            existing.expiryDate = expiryDate;
            existing.note = '刚买的';
            existing.updatedAt = now;
        } else {
            room.items.push({
                id: newId('hi', now), name, kind, expiryDate,
                icon: kind === 'consumable' ? '🛒' : '📦',
                note: '刚买的', updatedAt: now,
            });
        }
        summary = `购买了${name}（${roomName}·${kind === 'consumable' ? '消耗品' : '耐用品'}${expiryDate ? `·${expiryDate} 到期` : ''}）`;
    } else if (input.type === 'restock') {
        let itemRoom: HomeRoom | undefined;
        let item: HomeItem | undefined;
        // 带了新保质期时优先更新消耗品；不带时优先更新补给档位。
        if (expiryDate) {
            itemRoom = next.rooms.find(room => room.items.some(candidate =>
                matchKey(candidate.name) === matchKey(name) && isConsumable(candidate)));
            item = itemRoom?.items.find(candidate => matchKey(candidate.name) === matchKey(name) && isConsumable(candidate));
        }
        const supply = expiryDate ? undefined : next.supplies.find(candidate => matchKey(candidate.name) === matchKey(name));
        if (!expiryDate && !supply) {
            itemRoom = next.rooms.find(room => room.items.some(candidate =>
                matchKey(candidate.name) === matchKey(name) && isConsumable(candidate)));
            item = itemRoom?.items.find(candidate => matchKey(candidate.name) === matchKey(name) && isConsumable(candidate));
        }

        if (item && itemRoom) {
            item.kind = 'consumable';
            item.expiryDate = expiryDate;
            item.note = expiryDate ? '刚补过货' : '刚补过货，未记录新保质期';
            item.updatedAt = now;
            summary = `补充了${name}${expiryDate ? `，新保质期到 ${expiryDate}` : '，已清除旧保质期'}`;
        } else if (supply) {
            supply.level = 'plenty';
            supply.note = '刚补过货';
            supply.updatedAt = now;
            summary = `补充了${supply.name}，库存调为充足`;
        } else if (expiryDate) {
            const roomName = cleanName(input.roomName) || '厨房';
            let room = next.rooms.find(candidate => matchKey(candidate.name) === matchKey(roomName));
            if (!room) {
                room = { id: newId('hr', now), name: roomName, icon: '🚪', items: [] };
                next.rooms.push(room);
            }
            room.items.push({
                id: newId('hi', now), name, kind: 'consumable', icon: '🛒',
                note: '刚补过货', expiryDate, updatedAt: now,
            });
            summary = `新增消耗品${name}，保质期到 ${expiryDate}`;
        } else {
            next.supplies.push({
                id: newId('hs', now), name, icon: '📦', level: 'plenty',
                note: '刚补过货', updatedAt: now,
            });
            summary = `新增补给${name}，库存为充足`;
        }
    } else {
        const room = next.rooms.find(candidate => candidate.items.some(item =>
            matchKey(item.name) === matchKey(name) && (input.type === 'discard' || isConsumable(item))));
        if (room) {
            const index = room.items.findIndex(item =>
                matchKey(item.name) === matchKey(name) && (input.type === 'discard' || isConsumable(item)));
            room.items.splice(index, 1);
            summary = input.type === 'consume' ? `${name}已经吃完/用完，从住所移除` : `丢弃了${name}`;
        } else {
            const supply = next.supplies.find(candidate => matchKey(candidate.name) === matchKey(name));
            if (!supply) {
                return unchanged(input.type === 'consume'
                    ? `没有找到可消耗的「${name}」，未更新`
                    : `没有找到「${name}」，未更新`);
            }
            if (input.type === 'consume') {
                if (supply.level === 'out') return unchanged(`${supply.name}本来就用完了`);
                const previous: Record<HomeSupplyLevel, HomeSupplyLevel> = { plenty: 'ok', ok: 'low', low: 'out', out: 'out' };
                supply.level = previous[supply.level];
                supply.note = supply.level === 'out' ? '刚用完' : '刚消耗了一些';
                summary = `${supply.name}库存调为${{ plenty: '充足', ok: '还够', low: '快没了', out: '用完了' }[supply.level]}`;
            } else {
                if (supply.level === 'out') return unchanged(`${supply.name}本来就没有库存`);
                supply.level = 'out';
                supply.note = '已清空';
                summary = `清空了${supply.name}`;
            }
            supply.updatedAt = now;
        }
    }

    const record: HomeLifeEventRecord = {
        id: eventId, type: input.type, name, summary, timestamp: now, source: options.source,
    };
    next.recentEvents = [record, ...(next.recentEvents || [])].slice(0, 20);
    next.updatedAt = now;
    next.intuition = buildHomeIntuition(next);
    console.log(`🏠 [Home] ${summary}（${options.source}）`);
    return { profile: next, changed: true, summary };
}

// 多条推送同时落回、聊天与手动操作并发时，读改写仍按同一条队列执行。
let homeQueue: Promise<unknown> = Promise.resolve();

export function recordHomeLifeEvent(
    charId: string,
    input: HomeLifeEventInput,
    options: HomeLifeEventOptions,
): Promise<HomeLifeEventResult | null> {
    const run = homeQueue.then(async (): Promise<HomeLifeEventResult | null> => {
        const current = await DB.getHomeProfile(charId);
        if (!current) return null;
        const result = applyHomeLifeEvent(current, input, options);
        if (result.changed) await DB.saveHomeProfile(result.profile);
        return result;
    });
    homeQueue = run.catch(() => { /* 单次失败不阻塞后续生活事件 */ });
    return run;
}
