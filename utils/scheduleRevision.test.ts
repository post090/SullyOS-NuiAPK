import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile, DailySchedule } from '../types';
import { DB } from './db';
import { getDailyScheduleForChar } from './dailySchedule';
import { safeFetchJson } from './safeApi';
import { applyMergedRevisionFromEvalRaw, buildScheduleRevisionSection, reviseScheduleForEvent } from './scheduleRevision';

vi.mock('./dailySchedule', () => ({ getDailyScheduleForChar: vi.fn() }));
vi.mock('./safeApi', async importOriginal => ({
    ...await importOriginal<typeof import('./safeApi')>(),
    safeFetchJson: vi.fn(),
}));

const char: CharacterProfile = {
    id: 'schedule-revision-home',
    name: 'A',
    avatar: '',
    description: '',
    systemPrompt: '',
    memories: [],
    scheduleFeatureEnabled: true,
    scheduleConfig: { revisionMode: 'merged' },
    chibiStudio: {home3D: {state: {selected: {}}, hair: {layers: {}, extras: []}}},
};
const schedule: DailySchedule = {
    id: `${char.id}_2026-11-10`, charId: char.id, date: '2026-11-10', generatedAt: new Date(2026, 10, 10, 8).getTime(),
    slots: [
        {startTime: '14:00', activity: '午睡', location: '卧室', homePosition: {kind: 'home', roomId: 'starter-bedroom'}},
        {startTime: '18:00', activity: '做饭', location: '厨房', homePosition: {kind: 'home', roomId: 'starter-kitchen'}},
    ],
};
const revision = {
    reason: '我想先找一本书。',
    changes: [
        {type: 'modify', before: {startTime: '14:00'}, after: {startTime: '14:00', activity: '看书', homePosition: {kind: 'home', roomId: 'starter-study'}}},
        {type: 'add', after: {startTime: '16:00', activity: '散步', location: '公园', homePosition: {kind: 'away'}}},
        {type: 'modify', before: {startTime: '18:00'}, after: {startTime: '18:00', activity: '外卖'}},
        {type: 'add', after: {startTime: '19:00', activity: '喝茶', homePosition: {kind: 'home', roomId: 'deleted'}}},
    ],
};

beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2026, 10, 10, 12));
    vi.mocked(getDailyScheduleForChar).mockResolvedValue(schedule);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('home positions in autonomous schedule revisions', () => {
    it.each(['merged', 'standalone'] as const)('keeps a complete set of locations through %s revisions', async mode => {
        const save = vi.spyOn(DB, 'saveDailySchedule').mockResolvedValue(undefined);
        if (mode === 'merged') {
            const section = await buildScheduleRevisionSection(char);
            expect(section).toContain('changes 中每个 after必须额外包含 homePosition');
            expect(section).toContain('"id":"starter-study"');
            expect(section).toContain('午睡（卧室）');
            await applyMergedRevisionFromEvalRaw(JSON.stringify({scheduleRevision: revision}), char);
        } else {
            vi.mocked(safeFetchJson).mockResolvedValue({choices: [{message: {content: JSON.stringify(revision)}}]});
            expect(await reviseScheduleForEvent({
                char: {...char, scheduleConfig: {revisionMode: 'standalone'}},
                api: {baseUrl: 'https://test.invalid', apiKey: 'test', model: 'test'},
                source: 'world',
                eventSummary: '约了下午看书。',
            })).toBe(true);
            expect(vi.mocked(safeFetchJson).mock.calls[0][1]?.body).toContain('homePosition');
        }
        expect(save).toHaveBeenCalledOnce();
        expect(save.mock.calls[0][0].slots).toEqual([
            {startTime: '14:00', activity: '看书', location: '书房', homePosition: {kind: 'home', roomId: 'starter-study'}},
            {startTime: '16:00', activity: '散步', location: '公园', homePosition: {kind: 'away'}},
            schedule.slots[1],
        ]);
    });
});
