import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CharacterProfile, UserProfile, DailySchedule} from '../types';
import {buildHomeSchedulePrompt, hasHomeSchedulePositions, parseHomePosition} from './homeSchedule';
import {generateDailyScheduleForChar} from './scheduleGenerator';
import {DB} from './db';
vi.mock('./memoryPalace/pipeline', () => ({injectMemoryPalace: vi.fn()}));
vi.mock('./chatContextRange', () => ({loadCharacterContextRange: async () => ({messages: []})}));

const char = {id: 'home-schedule-test', name: 'A', scheduleFeatureEnabled: true, timeAwarenessEnabled: false,
    homeDefinition: {kind: 'between-worlds', notes: ''}, home3D: {version: 1, activeRoomId: 'study', rooms: [{id: 'study', name: '书房', level: 0, x: 0, z: 0, wall: '#ffffff', items: []}]}} as unknown as CharacterProfile;
const config = {baseUrl: 'https://test.invalid', apiKey: 'test', model: 'test'};
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe('home schedule positions', () => {
    it('requires all slots, rejects deleted rooms and never guesses a room from activity', () => {
        expect(parseHomePosition({kind: 'home', roomId: 'deleted'}, char)).toBeUndefined();
        expect(parseHomePosition({kind: 'away', roomId: 'study'}, char)).toEqual({kind: 'away'});
        expect(hasHomeSchedulePositions({slots: [{startTime: '10:00', activity: '书房直播'}]} as DailySchedule, char)).toBe(false);
        expect(buildHomeSchedulePrompt(char)).toContain('"id":"study"');
        expect(buildHomeSchedulePrompt({...char, homeDefinition: undefined})).toBe('');
    });
    it.each(['lifestyle', 'mindful'] as const)('generates and persists room IDs for %s schedules', async scheduleStyle => {
        vi.spyOn(DB, 'getScheduleCoverImage').mockResolvedValue(undefined as any);
        vi.spyOn(DB, 'getEmojis').mockResolvedValue([]);
        const save = vi.spyOn(DB, 'saveDailySchedule').mockResolvedValue(undefined);
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({choices: [{message: {content: JSON.stringify({slots: [
            {startTime: '09:00', activity: '直播', homePosition: {kind: 'home', roomId: 'study'}},
            {startTime: '14:00', activity: '外出', homePosition: {kind: 'away'}},
        ]})}}]}), {headers: {'Content-Type': 'application/json'}}));
        vi.stubGlobal('fetch', fetch);
        const result = await generateDailyScheduleForChar({...char, scheduleStyle}, {name: 'U'} as UserProfile, config, true);
        expect(hasHomeSchedulePositions(result, char)).toBe(true);
        expect(save).toHaveBeenCalledOnce();
        const messages=JSON.parse(fetch.mock.calls[0][1].body).messages;
        expect(messages.filter((message:{content:string})=>message.content.includes('每个 slots 项必须额外包含 homePosition'))).toHaveLength(1);
    });
    it('preserves the old schedule when generation omits positions', async () => {
        vi.spyOn(DB, 'getScheduleCoverImage').mockResolvedValue(undefined as any);
        vi.spyOn(DB, 'getEmojis').mockResolvedValue([]);
        const save = vi.spyOn(DB, 'saveDailySchedule').mockResolvedValue(undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({choices: [{message: {content: '{"slots":[{"startTime":"09:00","activity":"直播"}]}'}}]}))));
        expect(await generateDailyScheduleForChar(char, {name: 'U'} as UserProfile, config, true)).toBeNull();
        expect(save).not.toHaveBeenCalled();
    });
});
