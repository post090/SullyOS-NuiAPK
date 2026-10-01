import {afterEach,describe,it,expect,vi} from 'vitest';
import {parseBeautyCatalog,shuffleCatalog,validateCatalogCover} from './beautyCatalogContract';
import {loadBeautyCatalog,loadCatalogPreview,sameCatalogTerms} from './beautyCatalogClient';
import {validateBeautyMetadata} from './beautyShareContract';
const metadata={name:'月光',credit:'作者',platforms:['糯米机美化群'],contact:'',allowRemix:false,allowRedistribute:false,exportVersion:'test',bugFeedback:'welcome' as const,message:'',allowPublicListing:true};
const revision='a'.repeat(32),code='S-1234567890AB';
const entry={code,revision,sha256:'b'.repeat(64),bytes:100,kind:'chat-decoration' as const,metadata,categories:['chat','whitebox'],file:`items/${code}/${revision}.json`,cover:`items/${code}/${revision}.webp`};
afterEach(()=>vi.unstubAllGlobals());
describe('装扮库静态读取与格式边界',()=>{
  it('旧版说明不会被默认公开；拒绝伪造的授权类型、外站资源和重复作品',()=>{
    const old={...metadata};delete (old as any).allowPublicListing;
    expect(validateBeautyMetadata(old).allowPublicListing).toBeUndefined();
    expect(()=>validateBeautyMetadata({...old,allowPublicListing:'true'})).toThrow();
    for(const item of [{...entry,metadata:old},{...entry,file:'https://evil.invalid/file'},{...entry,cover:'../../private.json'}])expect(()=>parseBeautyCatalog({version:1,generatedAt:1,entries:[item]})).toThrow();
    expect(()=>parseBeautyCatalog({version:1,generatedAt:1,entries:[entry,entry]})).toThrow();
    expect(()=>validateCatalogCover('data:image/svg+xml,<svg/>')).toThrow();
    expect(()=>validateCatalogCover('data:image/png;base64,aGVsbG8=')).toThrow();
  });
  it('合并并发目录请求，每次进入重新校验静态缓存，失败可重试',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response('offline',{status:503})).mockImplementation(async()=>new Response(JSON.stringify({version:1,generatedAt:1,entries:[entry]})));
    vi.stubGlobal('fetch',fetch);
    await expect(loadBeautyCatalog('https://static.test')).rejects.toThrow();
    const a=loadBeautyCatalog('https://static.test'),b=loadBeautyCatalog('https://static.test');expect(a).toBe(b);
    expect((await a).entries).toHaveLength(1);await loadBeautyCatalog('https://static.test');expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.every(args=>args[0]==='https://static.test/catalog.json')).toBe(true);
    expect(fetch.mock.calls[0][1].credentials).toBe('omit');
    expect(fetch.mock.calls.every(args=>args[1].cache==='no-cache')).toBe(true);
  });
  it('交互预览只取选中的静态包，校验失败不会交给预览组件',async()=>{
    const pack={format:'sullyos-chat-decoration',version:1,name:'月光',parts:{css:'.sully-chat-root{color:red}'}};
    const raw=JSON.stringify(pack),bytes=new TextEncoder().encode(raw);
    const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const fetch=vi.fn().mockImplementation(async()=>new Response(raw));vi.stubGlobal('fetch',fetch);
    expect(await loadCatalogPreview({...entry,bytes:bytes.length,sha256},'https://static.test')).toEqual(pack);
    expect(fetch.mock.calls[0][0]).toBe('https://static.test/'+entry.file);
    await expect(loadCatalogPreview({...entry,bytes:bytes.length},'https://static.test')).rejects.toThrow('校验失败');
  });
  it('随机排序不改写原目录，更新版本或使用规范要求重新确认',()=>{
    const entries=[1,2,3,4];expect(shuffleCatalog(entries,()=>0)).toEqual([2,3,4,1]);expect(entries).toEqual([1,2,3,4]);
    const reversed=Object.fromEntries(Object.entries(metadata).reverse()) as typeof metadata;
    expect(sameCatalogTerms(entry,{...entry,metadata:reversed})).toBe(true);
    expect(sameCatalogTerms(entry,{...entry,revision:'c'.repeat(32)})).toBe(false);
    expect(sameCatalogTerms(entry,{...entry,metadata:{...metadata,allowRemix:true}})).toBe(false);
  });
});
