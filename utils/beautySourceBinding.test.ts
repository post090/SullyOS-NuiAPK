import {beforeEach,expect,it,vi} from 'vitest';
import {beautyFingerprint,bindBeautySource,readBeautyBinding} from './beautySourceBinding';
const assets=vi.hoisted(()=>new Map<string,string>());
vi.mock('./db',()=>({DB:{getAsset:async(key:string)=>assets.get(key)||null,saveAsset:async(key:string,data:string)=>{assets.set(key,data);}}}));
beforeEach(()=>assets.clear());
it('fingerprints actual content, ignoring local identities and object key order',async()=>{
 const a={type:'sully_appearance_preset',version:1,name:'主题',id:'local-a',createdAt:1,theme:{color:'red',size:1}};
 const b={...a,id:'local-b',createdAt:2,theme:{size:1,color:'red'}};
 expect(await beautyFingerprint(a,'appearance')).toBe(await beautyFingerprint(b,'appearance'));
 expect(await beautyFingerprint({...a,theme:{color:'blue',size:1}},'appearance')).not.toBe(await beautyFingerprint(a,'appearance'));
});
it('separates authors, stores only stable IDs and hashes, and never matches by name',async()=>{
 const binding={sourceId:'local-a',kind:'chat-decoration' as const,fingerprint:'hash',revision:'rev'};
 await bindBeautySource('author-a','submission',binding);
 expect(await readBeautyBinding('author-a','submission')).toEqual(binding);
 expect(await readBeautyBinding('author-b','submission')).toBeNull();
 expect(await readBeautyBinding('author-a','other')).toBeNull();
});
