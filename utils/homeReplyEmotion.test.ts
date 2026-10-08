import {it,expect,vi,beforeEach} from 'vitest';
import {evaluateHomeReplyEmotion} from './homeReplyEmotion';
const m=vi.hoisted(()=>({evaluate:vi.fn(),skip:vi.fn(()=>false)}));
vi.mock('../hooks/useChatAI',()=>({evaluateEmotionBackground:m.evaluate}));vi.mock('./devDebug',async importOriginal=>({...await importOriginal<typeof import('./devDebug')>(),isEmotionEvalSkipped:m.skip}));
const args:any={char:{id:'c',scheduleFeatureEnabled:true,emotionConfig:{enabled:true,api:{baseUrl:'emotion',model:'m',apiKey:'test'}}},user:{name:'U'},api:{baseUrl:'main',model:'m',stream:true},signal:new AbortController().signal};
beforeEach(()=>{vi.clearAllMocks();m.skip.mockReturnValue(false)});
it('uses shared evaluator and dedicated API with the same input as the main request',async()=>{await evaluateHomeReplyEmotion(args,[{role:'system',content:'context'},{role:'user',content:'hello'}]);expect(m.evaluate).toHaveBeenCalledOnce();expect(m.evaluate.mock.calls[0][3]).toEqual([{role:'user',content:'hello'}]);expect(m.evaluate.mock.calls[0][4]).toMatchObject({baseUrl:'emotion',stream:true});});
it('does not evaluate disabled or aborted turns',async()=>{for(const patch of [{signal:AbortSignal.abort()},{char:{...args.char,emotionConfig:{enabled:false}}},{char:{...args.char,scheduleFeatureEnabled:false}}])await evaluateHomeReplyEmotion({...args,...patch},[]);expect(m.evaluate).not.toHaveBeenCalled();});

it('regeneration evaluates afresh without the previous buffs',async()=>{
 await evaluateHomeReplyEmotion({...args,regenerating:true,char:{...args.char,buffInjection:'old',activeBuffs:[{name:'old'}]}},[{role:'system',content:'clean context'}]);
 expect(m.evaluate.mock.calls[0][0]).toMatchObject({buffInjection:'',activeBuffs:[]});
});
