import {describe,it,expect} from 'vitest';
import {createAssetQueue} from '../apps/room3d/assetQueue.js';
import {roomPixelRatio} from '../apps/room3d/renderQuality.js';
import {rollCacheKey,readRollCache,writeRollCache} from '../apps/room3d/chibi/rollCache';
describe('room loading',()=>{
 it('deduplicates and bounds concurrent model loads',async()=>{let active=0,max=0,count=0;const load=createAssetQueue(async()=>{count++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;},2);const a=load('a');expect(load('a')).toBe(a);await Promise.all([a,load('b'),load('c')]);expect(count).toBe(3);expect(max).toBe(2);});
 it('retries failed loads',async()=>{let count=0;const load=createAssetQueue(async()=>{if(!count++)throw Error('offline');});await expect(load('a')).rejects.toThrow('offline');await new Promise(r=>setTimeout(r,0));await expect(load('a')).resolves.toBeUndefined();});
 it('preserves phone resolution',()=>{expect(roomPixelRatio('clear',3,true)).toBe(3);expect(roomPixelRatio('balanced',3,true)).toBe(2);expect(roomPixelRatio('eco',3,true)).toBe(1.5);expect(roomPixelRatio('clear',1,true)).toBe(1);});
 it('invalidates converted characters when appearance or custom assets change',()=>{const key=rollCacheKey({hair:'a'},[])!;const result={image:'x',layers:{hair:'x'}};writeRollCache(key,result);expect(readRollCache(key)).toBe(result);expect(readRollCache(rollCacheKey({hair:'b'},[]))).toBeUndefined();expect(readRollCache(rollCacheKey({hair:'a'},[{src:'changed'}]))).toBeUndefined();expect(rollCacheKey(null,[])).toBeNull();});
});
