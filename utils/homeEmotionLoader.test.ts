import {it,expect,vi} from 'vitest';
import {loadHomeEmotion} from './homeEmotionLoader';
vi.mock('./db',()=>({DB:{getAssetRaw:async()=>null}}));
it('local-only emotion behavior does not request a model, including dedicated emotion API',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);try{const char:any={id:'c',scheduleFeatureEnabled:true,emotionConfig:{enabled:true,api:{baseUrl:'emotion',model:'m'}},activeBuffs:[{label:'高兴',intensity:3}]};expect(await loadHomeEmotion(char,{baseUrl:'main',model:'m'} as any,new AbortController().signal,true)).toBeUndefined();expect(fetcher).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}});
