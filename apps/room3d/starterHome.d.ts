import type {Home3DState} from './types';
export const STARTER_ROOMS:ReadonlyArray<{name:string;x:number;level:number;kind:string|null}>;
export function createStarterHome(catalog:unknown[],palette?:string):Home3DState;
