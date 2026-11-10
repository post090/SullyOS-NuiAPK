import type {CharacterProfile, DailySchedule, ScheduleSlot} from '../types';
import type {Home3DRoom} from '../apps/room3d/types';
import {STARTER_ROOMS} from '../apps/room3d/starterRooms.js';

export type HomeScheduleCharacter = Pick<CharacterProfile, 'home3D' | 'chibiStudio'>;
export type HomeScheduleRoom = Pick<Home3DRoom, 'id' | 'name' | 'level'>;

export function getHomeScheduleRooms(char?: HomeScheduleCharacter | null): readonly HomeScheduleRoom[] {
    if (!char?.chibiStudio?.home3D?.state) return [];
    return char.home3D?.rooms.length ? char.home3D.rooms : STARTER_ROOMS;
}

export function homePositionLabel(slot: ScheduleSlot, char?: HomeScheduleCharacter | null): string {
    const position = slot.homePosition;
    if (position?.kind === 'away') return `外出${slot.location && slot.location !== '外出' ? ` · ${slot.location}` : ''}`;
    if (position?.kind === 'home') {
        const rooms = char?.home3D?.rooms.length ? char.home3D.rooms : getHomeScheduleRooms(char);
        return rooms.find(room => room.id === position.roomId)?.name ?? '房间已变更，待补全';
    }
    return '';
}

export function parseHomePosition(value: unknown, rooms: readonly HomeScheduleRoom[]): ScheduleSlot['homePosition'] {
    if (!value || typeof value !== 'object') return undefined;
    const position = value as {kind?: unknown; roomId?: unknown};
    if (position.kind === 'away') return {kind: 'away'};
    if (position.kind === 'home' && typeof position.roomId === 'string' && rooms.some(room => room.id === position.roomId)) {
        return {kind: 'home', roomId: position.roomId};
    }
    return undefined;
}

export function hasHomeSchedulePositions(schedule: DailySchedule | null, char: Pick<CharacterProfile, 'home3D'>): boolean {
    return !!schedule?.slots.length && schedule.slots.every(slot => !!parseHomePosition(slot.homePosition, char.home3D?.rooms ?? []));
}

export function resolveHomeSchedulePlace(
    rooms: readonly HomeScheduleRoom[], value: unknown, location?: unknown,
): Pick<ScheduleSlot, 'homePosition' | 'location'> | undefined {
    const homePosition = parseHomePosition(value, rooms);
    if (!homePosition) return undefined;
    return {
        homePosition,
        location: homePosition.kind === 'home'
            ? rooms.find(room => room.id === homePosition.roomId)?.name
            : (typeof location === 'string' && location.trim().slice(0, 120)) || '外出',
    };
}

export function describeHomeScheduleRooms(rooms: readonly HomeScheduleRoom[]): string {
    return JSON.stringify(rooms.map(({id, name, level}) => ({id, name, floor: level + 1})));
}

export function buildHomeSchedulePrompt(rooms: readonly HomeScheduleRoom[], target = '每个 slots 项'): string {
    if (!rooms.length) return '';
    return `\n### 家园位置\n你的家园房间如下：${describeHomeScheduleRooms(rooms)}\n${target}必须额外包含 homePosition。在这个共同家园内时，写 {"kind":"home","roomId":"上面真实的房间ID"}；离开这个家园时写 {"kind":"away"}。location 同时写便于阅读的房间名称或外出地点。根据活动选择合适房间，不编造房间或ID，不把不在家硬解释成在客厅。意识流日程也要标出形象在家园的哪个房间或不在家，但不虚构现实身体活动。位置是安排，不是活动已经完成的记录。\n`;
}
