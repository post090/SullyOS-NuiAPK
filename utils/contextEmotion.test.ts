import {beforeEach,it,expect} from 'vitest';
import {ContextBuilder} from './context';
import {lastInnerStateKey} from './emotionState';
const char:any={id:'emotion-c',name:'C',scheduleFeatureEnabled:true,emotionConfig:{enabled:true},buffInjection:'BUFF_MARK'};
const user:any={name:'U'};
beforeEach(()=>localStorage.clear());
it('only chat and home read the shared latest state without a schedule',async ()=>{
 localStorage.setItem(lastInnerStateKey(char.id),'INNER_MARK');
 expect((await ContextBuilder.buildCoreContext(char,user))).not.toMatch(/BUFF_MARK|INNER_MARK/);
 for(const surface of ['chat','home'] as const){
  const core=(await ContextBuilder.buildCoreContext(char,user,true,undefined,undefined,undefined,{emotion:{surface}}));
  expect(core).toContain('BUFF_MARK');expect(core).toContain('INNER_MARK');
 }
 localStorage.setItem(lastInnerStateKey(char.id),'NEW_INNER');
 expect((await ContextBuilder.buildVolatileCoreState(char,{emotion:{surface:'chat'}}))).toContain('NEW_INNER');
});
it('disabled emotions omit both and explicit empty inner state suppresses stale cache',()=>{
 localStorage.setItem(lastInnerStateKey(char.id),'INNER_MARK');
 expect(ContextBuilder.buildEmotionContext({...char,emotionConfig:{enabled:false}},{surface:'home'})).toBe('');
 expect(ContextBuilder.buildEmotionContext({...char,scheduleFeatureEnabled:false},{surface:'chat'})).toBe('');
 expect(ContextBuilder.buildEmotionContext({...char,buffInjection:''},{surface:'chat',innerState:''})).toBe('');
});
it('split prompt includes emotions exactly once',async ()=>{
 localStorage.setItem(lastInnerStateKey(char.id),'INNER_MARK');
 const core=(await ContextBuilder.buildCoreContext(char,user,true,undefined,undefined,undefined,{deferVolatile:true,emotion:{surface:'chat'}}));
 const live=(await ContextBuilder.buildVolatileCoreState(char,{emotion:{surface:'chat'}}));
 expect((core+live).split('INNER_MARK')).toHaveLength(2);expect((core+live).split('BUFF_MARK')).toHaveLength(2);
});
