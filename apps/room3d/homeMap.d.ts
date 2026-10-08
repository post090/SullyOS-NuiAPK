import type {Home3DRoom} from './types';
export function homeMap(home:{activeRoomId:string;rooms:Pick<Home3DRoom,'id'|'name'|'x'|'z'|'level'|'wall'>[]},residentRoom?:string|null):string;

export function homeDisplayX(home:{rooms:Pick<Home3DRoom,'x'|'z'|'level'>[]},room:Pick<Home3DRoom,'x'|'z'|'level'>):number;
