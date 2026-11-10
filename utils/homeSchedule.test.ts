import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CharacterProfile, UserProfile, DailySchedule, ScheduleSlot} from '../types';
import {buildHomeSchedulePrompt, getHomeScheduleRooms, hasHomeSchedulePositions, homePositionLabel, parseHomePosition} from './homeSchedule';
import {generateDailyScheduleForChar} from './scheduleGenerator';
import {DB} from './db';
import {createStarterHome} from '../apps/room3d/starterHome.js';
import catalog from '../public/room3d/catalog.json';
vi.mock('./memoryPalace/pipeline', () => ({injectMemoryPalace: vi.fn()}));
vi.mock('./chatContextRange', () => ({loadCharacterContextRange: async () => ({messages: []})}));

const char = {id: 'home-schedule-test', name: 'A', scheduleFeatureEnabled: true, timeAwarenessEnabled: false,
    chibiStudio: {home3D: {state: {selected: {}}, hair: {layers: {}, extras: []}}},
    homeDefinition: {kind: 'between-worlds', notes: ''}, home3D: {version: 1, activeRoomId: 'study', rooms: [{id: 'study', name: '书房', level: 0, x: 0, z: 0, wall: '#ffffff', items: []}]}} as unknown as CharacterProfile;
const config = {baseUrl: 'https://test.invalid', apiKey: 'test', model: 'test'};
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});

function mockGeneration(slots: ScheduleSlot[]) {
    vi.spyOn(DB, 'getScheduleCoverImage').mockResolvedValue(null);
    vi.spyOn(DB, 'getEmojis').mockResolvedValue([]);
    vi.spyOn(DB, 'getAllCharacters').mockResolvedValue([]);
    const save = vi.spyOn(DB, 'saveDailySchedule').mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        choices: [{message: {content: JSON.stringify({slots})}}],
    }), {headers: {'Content-Type': 'application/json'}}));
    vi.stubGlobal('fetch', fetch);
    return {fetch, save};
}

describe('home schedule positions', () => {
    it('requires all slots, rejects deleted rooms and never guesses a room from activity', () => {
        const rooms = getHomeScheduleRooms(char);
        expect(parseHomePosition({kind: 'home', roomId: 'deleted'}, rooms)).toBeUndefined();
        expect(parseHomePosition({kind: 'away', roomId: 'study'}, rooms)).toEqual({kind: 'away'});
        expect(hasHomeSchedulePositions({slots: [{startTime: '10:00', activity: '书房直播'}]} as DailySchedule, char)).toBe(false);
        expect(buildHomeSchedulePrompt(rooms)).toContain('"id":"study"');
    });
    it.each(['lifestyle', 'mindful'] as const)('generates and persists room IDs for %s schedules', async scheduleStyle => {
        const {fetch, save} = mockGeneration([
            {startTime: '09:00', activity: '直播', homePosition: {kind: 'home', roomId: 'study'}},
            {startTime: '14:00', activity: '外出', homePosition: {kind: 'away'}},
        ]);
        const result = await generateDailyScheduleForChar({...char, scheduleStyle}, {name: 'U'} as UserProfile, config, true);
        expect(hasHomeSchedulePositions(result, char)).toBe(true);
        expect(save).toHaveBeenCalledOnce();
        const messages=JSON.parse(fetch.mock.calls[0][1].body).messages;
        expect(messages.filter((message:{content:string})=>message.content.includes('每个 slots 项必须额外包含 homePosition'))).toHaveLength(1);
    });
    it('schedules before home setup and recognizes the same rooms after choosing a palette', async () => {
        const unbuilt = {...char, home3D: undefined, homeDefinition: undefined};
        vi.spyOn(DB, 'getDailySchedule').mockResolvedValue(null);
        const {fetch, save} = mockGeneration([
            {startTime: '09:00', activity: '看书', homePosition: {kind: 'home', roomId: 'starter-study'}},
            {startTime: '14:00', activity: '散步', location: '公园', homePosition: {kind: 'away'}},
        ]);
        const result = await generateDailyScheduleForChar(unbuilt, {name: 'U'} as UserProfile, config);
        expect(result?.slots.map(slot => homePositionLabel(slot, unbuilt))).toEqual(['书房', '外出 · 公园']);
        expect(save).toHaveBeenCalledWith(result);
        const messages = JSON.parse(fetch.mock.calls[0][1].body).messages;
        expect(messages.some((message: {content: string}) => message.content.includes('"id":"starter-study"'))).toBe(true);
        expect(hasHomeSchedulePositions(result, {...unbuilt, home3D: createStarterHome(catalog, 'aqua')})).toBe(true);
    });
    it('keeps the regular schedule format for roles with no confirmed home figure', async () => {
        const {fetch, save} = mockGeneration([{startTime: '09:00', activity: '看书', location: '图书馆'}]);
        const unconfirmed = {...char, chibiStudio: {room: {state: {selected: {}}}}};
        const result = await generateDailyScheduleForChar(unconfirmed, {name: 'U'} as UserProfile, config, true);
        expect(result?.slots[0]).toMatchObject({activity: '看书', location: '图书馆'});
        expect(result?.slots[0]).not.toHaveProperty('homePosition');
        expect(save).toHaveBeenCalledWith(result);
        const messages = JSON.parse(fetch.mock.calls[0][1].body).messages;
        expect(messages.some((message: {content: string}) => message.content.includes('homePosition'))).toBe(false);
    });
    it('preserves the old schedule when generation omits positions', async () => {
        const {save} = mockGeneration([{startTime: '09:00', activity: '直播'}]);
        expect(await generateDailyScheduleForChar(char, {name: 'U'} as UserProfile, config, true)).toBeNull();
        expect(save).not.toHaveBeenCalled();
    });
});
