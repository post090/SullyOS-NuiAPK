import { beforeEach, expect, it } from 'vitest';
import * as M from './fishingMarket';
import { applyMarketNPCs, parseMarketNPCs, prepareMarketNPCs } from './marketNPCs';
import { applyMarketPlan, buildMarketTurn, marketReceiptContent, parseMarketPlan } from './fishingCharacter';
import { collectSARLocalBackup, restoreSARLocalBackup } from './sarBackup';
const user: M.MarketActor = {id:'user',name:'用户',kind:'user'};
const char: M.MarketActor = {id:'char',name:'朋友',kind:'character'};
const story = '{{participant}}刚进门，报幕员就宣布电梯抵达三楼。门外仍是一楼。他小声解释：这是配音演员的期末补考。';
const initial = () => M.ensureActorAccounts(M.createFishingMarketState(42), [user,char]);
function fixture(mode: 'buy'|'work'|'free' = 'buy', price = 16) {
 const input=initial(), snapshot=prepareMarketNPCs(input,()=>.1);
 const ids=snapshot.visitors.map(v=>v.id);
 const data={personas:ids.map((actorId,i)=>({actorId,name:'路人'+i,identity:'电梯配音专业的留级生'})),actions:[
  {actorId:ids[0],action:'encounter',ref:'n1',mode,price,title:'有偿试乘纸箱电梯',words:'楼层不保真，报站很认真。',event:{story}},
  {actorId:ids[1],action:'comment',targetId:'n1',words:'你昨天还说自己是货梯。'},
  {actorId:ids[0],action:'comment',targetId:'n1',words:'专业调剂了。'},
 ]};
 const result=applyMarketNPCs(input,snapshot,parseMarketNPCs(JSON.stringify(data),snapshot));
 return {input,snapshot,data,state:result.state,post:[...result.state.listings,...result.state.requests][0]};
}
beforeEach(()=>localStorage.clear());
it('generates public posts and private complete events together, with a temporary persona and no execution',()=>{
 const {state,post}=fixture();
 expect(post.npcPersona?.name).toBe('路人0');expect(post.encounter?.story).toBe(story);expect(post.encounterResult).toBeUndefined();
 expect(state.accounts.user).toBe(initial().accounts.user);expect(state.inventory).toHaveLength(0);
 expect(state.ledger.map(e=>e.text).join('\n')).not.toContain('期末补考');
 const next=prepareMarketNPCs(state,()=>.1);
 expect(next.prompt).not.toContain('期末补考');expect(next.visitors[0].persona?.name).toBe('路人0');
 expect(buildMarketTurn(char,state)).toContain(story);
});
it('a user purchase reveals the prewritten event once, debits only the posted amount and survives backup',()=>{
 const {state,post}=fixture();const after=M.buyListing(state,post.id,user);
 expect(after.accounts.user).toBe(state.accounts.user-16);expect(after.accounts['wanderer:0']).toBe(state.accounts['wanderer:0']+16);
 expect(after.listings[0].encounterResult?.story).toBe(story.replace('{{participant}}','用户'));
 expect(after.inventory).toHaveLength(0);expect(()=>M.buyListing(after,post.id,user)).toThrow();
 expect(marketReceiptContent(after.ledger.at(-1)!)).toContain('期末补考');
 M.saveFishingMarketState(after);const backup=collectSARLocalBackup();localStorage.clear();restoreSARLocalBackup(backup,{replaceMissing:true});
 expect(M.readFishingMarketState().listings[0].encounterResult).toEqual(after.listings[0].encounterResult);
 expect(prepareMarketNPCs(after,()=>.1).prompt).toContain('期末补考');
});
it('work pays from the finite NPC wallet and accepts participation without a fabricated completion essay',()=>{
 const {state,post}=fixture('work',12), after=M.fulfillRequest(state,post.id,user);
 expect(after.accounts.user).toBe(state.accounts.user+12);expect(after.accounts['wanderer:0']).toBe(state.accounts['wanderer:0']-12);
 expect(after.requests[0].encounterResult?.participantId).toBe('user');expect(()=>M.fulfillRequest(after,post.id,char)).toThrow();
});
it('free events use the same once-only settlement and never mint rewards',()=>{
 const {state,post}=fixture('free',0),after=M.buyListing(state,post.id,user);
 expect(after.accounts).toEqual(state.accounts);expect(after.listings[0].encounterResult).toBeDefined();
});
it('a character chooses one post and its reaction lands with that exact event in the receipt',()=>{
 const {state,post}=fixture('work',8);
 const p=parseMarketPlan(`<ACTION>fulfill</ACTION><TARGET>${post.id}</TARGET><NOTE>去搭一下这个电梯。</NOTE><REACTION>下次能报个博士楼层吗？</REACTION>`)!;
 const after=applyMarketPlan(state,char,p);
 expect(after.requests[0].encounterResult).toMatchObject({participantId:'char',reaction:'下次能报个博士楼层吗？'});
 expect(after.ledger.at(-1)?.text).toContain('下次能报个博士楼层吗');
 expect(after.ledger.at(-1)?.text).toContain('朋友刚进门');
});
it('failed/expired transactions and mere comments never reveal an event or record a reaction',()=>{
 const {state,post}=fixture();const before=JSON.stringify(state);
 expect(()=>M.buyListing({...state,accounts:{...state.accounts,user:0}},post.id,user,Date.now(),'反应')).toThrow();
 expect(()=>M.buyListing(state,post.id,user,post.expiresAt)).toThrow();expect(JSON.stringify(state)).toBe(before);
 const commented=M.commentOnPost(state,post.id,user,'想看看');expect(commented.listings[0].encounterResult).toBeUndefined();
 expect(commented.ledger.at(-1)?.text).not.toContain('期末补考');
});
it('rejects malformed hidden events, impersonated actor ids, incomplete personas and paid free events',()=>{
 const {snapshot,data}=fixture();
 for(const modify of [
  (d:any)=>delete d.actions[0].event,
  (d:any)=>d.actions[0].event.story='   ',
  (d:any)=>d.actions[0].mode='free',
  (d:any)=>d.personas[0].actorId='user',
  (d:any)=>delete d.personas,
 ]){const d=structuredClone(data);modify(d);expect(()=>parseMarketNPCs(JSON.stringify(d),snapshot)).toThrow();}
});
it('refuses to rename an NPC with open posts, and changing persona never refills a wallet',()=>{
 const {state,data}=fixture(),snapshot=prepareMarketNPCs(state,()=>.1);
 const altered=structuredClone(data);altered.personas[0].name='另一个人';const kept=parseMarketNPCs(JSON.stringify(altered),snapshot);expect(kept[0].persona).toEqual(snapshot.visitors[0].persona);const applied=applyMarketNPCs(state,snapshot,kept);expect(applied.state.accounts).toEqual(state.accounts);expect(applied.state.listings.at(-1)?.npcPersona?.name).toBe('路人0');
 const closed=M.removeMarketPost(state,state.listings[0].id,'wanderer:0');const next=prepareMarketNPCs(closed,()=>.1);
 const generated=applyMarketNPCs(closed,next,parseMarketNPCs(JSON.stringify(altered),next));
 expect(generated.state.accounts).toEqual(closed.accounts);expect(generated.state.listings[0].npcPersona?.name).toBe('路人0');
});
it('other NPCs cannot consume hidden encounters intended for the user or characters',()=>{
 const {state,post}=fixture(),snapshot=prepareMarketNPCs(state,()=>.1);
 const result=applyMarketNPCs(state,snapshot,[{actorId:'wanderer:1',action:'buy',targetId:post.id,words:'代买。'},{actorId:'wanderer:0',action:'comment',targetId:post.id,words:'等等。'}]);
 expect(result.skipped).toHaveLength(1);expect(result.state.listings[0].status).toBe('open');
});
it('corrupt event saves fail without overwriting storage',()=>{
 const {state}=fixture();state.listings[0].encounter={story:''};M.saveFishingMarketState(state);
 const raw=localStorage.getItem(M.FISHING_MARKET_STORAGE_KEY);expect(()=>M.readFishingMarketState()).toThrow('路人事件');
 expect(localStorage.getItem(M.FISHING_MARKET_STORAGE_KEY)).toBe(raw);
});

 it('preserves stories beyond 600/1200 characters through settlement and backup',()=>{
   const {input,snapshot,data}=fixture();const long='完整的故事。'.repeat(400)+'{{participant}}看到了结尾。';
   data.actions[0].event!.story=long;
   const generated=applyMarketNPCs(input,snapshot,parseMarketNPCs(JSON.stringify(data),snapshot));
   const post=generated.state.listings[0];expect(post.encounter?.story).toBe(long);
   const settled=M.buyListing(generated.state,post.id,user,Date.now(),'反应'.repeat(400));
   expect(settled.listings[0].encounterResult?.story).toBe(long.replace('{{participant}}','用户'));
   expect(settled.listings[0].encounterResult?.reaction).toBe('反应'.repeat(400));
   M.saveFishingMarketState(settled);const backup=collectSARLocalBackup();localStorage.clear();restoreSARLocalBackup(backup,{replaceMissing:true});
   expect(M.readFishingMarketState().listings[0].encounterResult?.story).toBe(long.replace('{{participant}}','用户'));
 });
