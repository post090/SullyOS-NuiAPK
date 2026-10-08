import type {CharacterProfile, DailySchedule, ScheduleSlot} from '../types';

export function homePositionLabel(slot: ScheduleSlot, char?: Pick<CharacterProfile, 'home3D'> | null): string {
    const position = slot.homePosition;
    if (position?.kind === 'away') return `外出${slot.location && slot.location !== '外出' ? ` · ${slot.location}` : ''}`;
    if (position?.kind === 'home') return char?.home3D?.rooms.find(room => room.id === position.roomId)?.name ?? '房间已变更，待补全';
    return '';
}

export function parseHomePosition(value: unknown, char: Pick<CharacterProfile, 'home3D'>): ScheduleSlot['homePosition'] {
    if (!value || typeof value !== 'object') return undefined;
    const position = value as {kind?: unknown; roomId?: unknown};
    if (position.kind === 'away') return {kind: 'away'};
    if (position.kind === 'home' && char.home3D?.rooms.some(room => room.id === position.roomId)) {
        return {kind: 'home', roomId: position.roomId as string};
    }
    return undefined;
}

export function hasHomeSchedulePositions(schedule: DailySchedule | null, char: Pick<CharacterProfile, 'home3D'>): boolean {
    return !!schedule?.slots.length && schedule.slots.every(slot => !!parseHomePosition(slot.homePosition, char));
}

export function buildHomeSchedulePrompt(char: Pick<CharacterProfile, 'home3D' | 'homeDefinition'>): string {
    if (!char.homeDefinition || !char.home3D?.rooms.length) return '';
    const rooms = char.home3D.rooms.map(room => ({id: room.id, name: room.name, floor: room.level + 1}));
    return `\n### 家园位置（每条日程必填）\n你的家园房间如下：${JSON.stringify(rooms)}\n每个 slots 项必须额外包含 homePosition。在这个共同家园内时，写 {"kind":"home","roomId":"上面真实的房间ID"}；离开这个家园时写 {"kind":"away"}。location 同时写便于阅读的房间名称或外出地点。根据活动选择合适房间，不编造房间或ID，不把所有活动都安排在家，不把不在家硬解释成在客厅。意识流日程也要标出形象在家园的哪个房间或不在家，但不虚构现实身体活动。位置是安排，不是活动已经完成的记录。\n`;
}
