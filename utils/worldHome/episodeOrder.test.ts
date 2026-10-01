import { describe, expect, it } from 'vitest';
import { DB } from '../db';
import type { WorldEpisode, WorldProfile } from '../../types';
import { orderWorldEpisodes, recoverWorldProgress } from './episodeOrder';
import { realObserveTarget, formatRealClock } from './prompts';

const episode = (id: string, round: number, createdAt: number): WorldEpisode => ({
    id, worldId: 'order-world', round, createdAt, trigger: 'observe',
    storyTime: '2026年9月16日 周三 晚上', summary: id, beats: [],
});
const world = (): WorldProfile => ({ id: 'order-world', name: '家园', timeMode: 'real', clockSegs: 4,
    storyClock: 3, realClock: { dayKey: '2026-09-16', seg: 1 },
    memberIds: [], npcs: [], houses: [], relationships: [], worldview: '', mode: 'light', createdAt: 0, updatedAt: 0,
});

describe('observation order and stale world progress', () => {
    it('places the after-midnight observation first and distinguishes old duplicate rounds without rewriting references', async () => {
        const evening = episode('evening', 4, new Date(2026, 8, 16, 21, 16).getTime());
        const midnight = episode('midnight', 4, new Date(2026, 8, 17, 1, 43).getTime());
        await DB.saveWorldEpisode(midnight); await DB.saveWorldEpisode(evening);
        const result = await DB.getWorldEpisodes('order-world', 1);
        expect(result[0]).toMatchObject({ id: 'midnight', round: 4, observationNumber: 5 });
        expect(orderWorldEpisodes([midnight, evening]).map(item => item.id)).toEqual(['midnight', 'evening']);
        expect(midnight.round).toBe(4);
    });
    it('recovers counters and chooses the next early-morning segment instead of repeating evening', () => {
        const current = world();
        recoverWorldProgress(current, orderWorldEpisodes([episode('a', 4, 1), episode('b', 4, 2)]));
        expect(current.storyClock + 1).toBe(6);
        const next = realObserveTarget(current, new Date(2026, 8, 17, 2));
        expect(next).toEqual({ dayKey: '2026-09-16', seg: 3 });
        expect(formatRealClock(next!)).toBe('2026年9月17日 周四 凌晨');
    });
    it('does not undo a deliberate timezone clock adjustment when the counter is current', () => {
        const current = { ...world(), storyClock: 4, realClock: { dayKey: '2026-09-15', seg: 0 } };
        recoverWorldProgress(current, [episode('a', 4, 1)]);
        expect(current.realClock).toEqual({ dayKey: '2026-09-15', seg: 0 });
    });
    it('keeps engine progress when a stale UI changes an unrelated field', async () => {
        await DB.saveWorld({ ...world(), storyClock: 8, realClock: { dayKey: '2026-09-17', seg: 0 } });
        await DB.updateWorld('order-world', { name: '新名字' });
        expect(await DB.getWorld('order-world')).toMatchObject({ name: '新名字', storyClock: 8, realClock: { dayKey: '2026-09-17', seg: 0 } });
    });
    it('does not recreate a world deleted while an editor was open', async () => {
        await DB.updateWorld('missing-world', { name: '过期编辑' });
        expect(await DB.getWorld('missing-world')).toBeNull();
    });
});
