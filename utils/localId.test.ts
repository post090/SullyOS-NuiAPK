import {afterEach,expect,it,vi} from 'vitest';
import {createLocalId} from './localId.js';
afterEach(()=>vi.unstubAllGlobals());
it('uses native UUID when available',()=>{
 vi.stubGlobal('crypto',{randomUUID:()=> 'native-id'});expect(createLocalId()).toBe('native-id');
});
it('uses random bytes without requiring a secure context',()=>{
 let seed=0;const bytes=vi.fn((buffer:Uint8Array)=>{for(let i=0;i<buffer.length;i++)buffer[i]=seed++;return buffer;});
 vi.stubGlobal('crypto',{getRandomValues:bytes});
 const first=createLocalId();expect(first).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
 expect(createLocalId()).not.toBe(first);expect(bytes).toHaveBeenCalledTimes(2);
});
it('still provides local record IDs in older webviews',()=>{
 vi.stubGlobal('crypto',undefined);const ids=Array.from({length:100},createLocalId);expect(new Set(ids).size).toBe(100);
});
