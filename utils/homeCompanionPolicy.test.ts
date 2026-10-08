import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {loadCompanionPolicy} from './homeCompanionPolicy';
import {quietCompanion} from './homeCompanion';
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),plates:vi.fn()}));
vi.mock('./db',()=>({DB:{getAssetRaw:mocks.read,saveAssetRaw:mocks.save}}));
vi.mock('./memoryPalace/db',()=>({RoomPlateDB:{getByCharId:mocks.plates}}));
vi.mock('./safeApi',()=>({safeResponseJson:(r:Response)=>r.json()}));
const char={id:'c',name:'C',memoryPalaceEnabled:true} as any,user={name:'U'} as any,api={baseUrl:'https://example.test/v1',model:'fake',apiKey:'test'} as any;
const policy={approach:.8,follow:.4,sit:.6,warmth:.9};
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue(null);mocks.plates.mockResolvedValue([{room:'bedroom',entries:[{text:'喜欢待在对方身边'}]}]);fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(policy)}}]})));vi.stubGlobal('fetch',fetcher);});
afterEach(()=>vi.unstubAllGlobals());
it('does not read memories or call a model when memory is disabled',async()=>{expect(await loadCompanionPolicy({...char,memoryPalaceEnabled:false},user,api,new AbortController().signal)).toEqual(quietCompanion);expect(mocks.plates).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();});
it('reuses interpretation until relationship material changes',async()=>{expect(await loadCompanionPolicy(char,user,api,new AbortController().signal)).toEqual(policy);const cache=mocks.save.mock.calls[0][1];mocks.read.mockResolvedValue(cache);expect(await loadCompanionPolicy(char,user,api,new AbortController().signal)).toEqual(policy);expect(fetcher).toHaveBeenCalledOnce();mocks.plates.mockResolvedValue([{room:'bedroom',entries:[{text:'现在更需要独处'}]}]);fetcher.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(policy)}}]})));await loadCompanionPolicy(char,user,api,new AbortController().signal);expect(fetcher).toHaveBeenCalledTimes(2);});
it('does not cache malformed output or an aborted result',async()=>{fetcher.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'oops'}}]})));await expect(loadCompanionPolicy(char,user,api,new AbortController().signal)).rejects.toThrow();expect(mocks.save).not.toHaveBeenCalled();const controller=new AbortController();controller.abort();expect(await loadCompanionPolicy(char,user,api,controller.signal)).toEqual(quietCompanion);expect(fetcher).toHaveBeenCalledOnce();});
it('empty plates never generate invented relationship tendencies',async()=>{mocks.plates.mockResolvedValue([]);expect(await loadCompanionPolicy(char,user,api,new AbortController().signal)).toEqual(quietCompanion);expect(fetcher).not.toHaveBeenCalled();});

it('local-only accompaniment never requests interpretation even with API configured',async()=>{expect(await loadCompanionPolicy(char,user,api,new AbortController().signal,true)).toEqual(quietCompanion);expect(fetcher).not.toHaveBeenCalled();});
