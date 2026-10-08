import type {RollResult} from './CreatorRollBridge';
const entries=new Map<string,RollResult>();
let bytes=0;
const size=(r:RollResult)=>2*(r.image.length+Object.values(r.layers).reduce((n,s)=>n+s.length,0));
export function rollCacheKey(state:unknown,items:unknown[]|undefined){return state?JSON.stringify([state,items??[]]):null;}
export function readRollCache(key:string|null){if(!key)return undefined;const result=entries.get(key);if(result){entries.delete(key);entries.set(key,result);}return result;}
export function writeRollCache(key:string,result:RollResult){const old=entries.get(key);if(old)bytes-=size(old);entries.delete(key);entries.set(key,result);bytes+=size(result);while(bytes>32*1024*1024||entries.size>6){const first=entries.keys().next().value!;bytes-=size(entries.get(first)!);entries.delete(first);}}
