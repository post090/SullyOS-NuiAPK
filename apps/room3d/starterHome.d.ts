import type {Home3DState,Home3DRoom} from './types';
export {STARTER_ROOMS} from './starterRooms.js';
export function createStarterHome(catalog:unknown[],palette?:string):Home3DState;
export function defaultRoomLayout(home:Home3DState,room:Home3DRoom,catalog:unknown[]):Home3DRoom|null;
export function hasDefaultRoomLayout(home:Home3DState,room:Home3DRoom):boolean;
