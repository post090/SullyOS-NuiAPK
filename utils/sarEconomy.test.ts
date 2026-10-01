import { describe, it, expect, vi } from 'vitest';
import * as M from './vrWorld/fishingMarket';
import { SAR_DAILY_BUYBACK, SAR_WALLET_LIMIT, remainingSARBuyback, sarEconomyDay } from './vrWorld/sarEconomy';
import { acquireCharacterModule, consumeCharacterModule, characterModuleAllowance } from './vrWorld/sarCharacterCommerce';
import { SAR_MODULE_CATALOG, createSARModuleShopState } from './vrWorld/sarModuleShop';
import { sarWarehouseItems } from './vrWorld/sarWarehouse';
import { collectSARLocalBackup, restoreSARLocalBackup } from './vrWorld/sarBackup';
const user: M.MarketActor={id:'user',name:'我',kind:'user'}, char: M.MarketActor={id:'aran',name:'阿岚',kind:'character'};
const now=new Date(2026,8,10,12).getTime();
const init=()=>M.ensureMarketDay(M.ensureActorAccounts(M.createFishingMarketState(42),[user,char]),now);
const caught=(id:string,actor=user,speciesId='glass-minnow'):M.FishingCatch=>({id,ownerId:actor.id,ownerName:actor.name,speciesId,caughtAt:now,weather:'clear',weatherLabel:'晴',weatherSource:'simulated',quality:1,sizeCm:24});
const memory=(state=init())=>{const data=new Map([[M.FISHING_MARKET_STORAGE_KEY,JSON.stringify(state)]]);return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};};
describe('SAR economy boundaries',()=>{
    it('new wallets get 120 once; old money and listings survive same-day repricing',()=>{
        let state=init();expect(state.accounts).toEqual({user:120,aran:120});
        state={...state,economyVersion:undefined,accounts:{user:1000,aran:SAR_WALLET_LIMIT+100},prices:{'glass-minnow':1000}};
        state=M.createListing(state,char,null,123,'',now,'旧商品');
        const next=M.ensureMarketDay(M.ensureActorAccounts(state,[user,char]),now);
        expect(next.accounts).toEqual(state.accounts);expect(next.listings[0].price).toBe(123);expect(next.prices['glass-minnow']).toBeLessThanOrEqual(9);
    });
    it('every species at every quality fits one fresh daily buyback allowance',()=>{
        for(let day=0;day<366;day++){
            const state=M.ensureMarketDay(init(),now+day*M.MARKET_DAY_MS);
            for(const species of M.FISH_CATALOG) for(const quality of [1,2,3] as const){
                const value=M.catchValue(state,{...caught('fish',user,species.id),quality});
                expect(Number.isSafeInteger(value)).toBe(true);expect(value).toBeGreaterThan(0);expect(value).toBeLessThanOrEqual(129);expect(value).toBeLessThan(SAR_DAILY_BUYBACK);
            }
        }
    });
    it('system income cannot exceed 180; a rejected sale preserves money and the complete item',()=>{
        let state=init();state.prices['glass-minnow']=9;
        for(let i=0;i<20;i++)state=M.handleCollection(M.addCatchToState(state,caught(`f${i}`)),user,`f${i}`,'sell',now);
        expect(state.accounts.user).toBe(300);expect(remainingSARBuyback(state.buybackBudgets,'user',now)).toBe(0);
        state=M.addCatchToState(state,caught('keep'));const before=JSON.stringify(state);
        expect(()=>M.handleCollection(state,user,'keep','sell',now)).toThrow('回收额度');expect(JSON.stringify(state)).toBe(before);
        const reloaded=M.readFishingMarketState(memory(state));expect(()=>M.handleCollection(reloaded,user,'keep','sell',now)).toThrow();
        expect(()=>M.handleCollection(state,user,'keep','sell',now-M.MARKET_DAY_MS)).toThrow();
        const tomorrow=M.handleCollection(state,user,'keep','sell',now+M.MARKET_DAY_MS);expect(tomorrow.accounts.user).toBe(309);
        expect(remainingSARBuyback(tomorrow.buybackBudgets,'user',now+M.MARKET_DAY_MS)).toBe(171);
    });
    it('allowances are personal, and normal trading does not mint money or use buyback allowance',()=>{
        let state=init();state.buybackBudgets={user:{day:sarEconomyDay(now),earned:180}};
        const fish=caught('a',char);state=M.addCatchToState(state,fish);state=M.createListing(state,char,fish,30,'',now);
        const traded=M.buyListing(state,state.listings[0].id,user,now);expect(traded.accounts).toEqual({user:90,aran:150});expect(traded.buybackBudgets).toEqual(state.buybackBudgets);
        expect(remainingSARBuyback(traded.buybackBudgets,char.id,now)).toBe(180);
    });
    it('concurrent sales cannot exceed the remaining system allowance',async()=>{
        const clock=vi.spyOn(Date,'now').mockReturnValue(now);
        try {
        let state=init();state.buybackBudgets={user:{day:sarEconomyDay(now),earned:172}};
        state=M.addCatchToState(M.addCatchToState(state,caught('a')),caught('b'));state.prices['glass-minnow']=8;
        const storage=memory(state);
        const results=await Promise.allSettled(['a','b'].map(id=>M.mutateFishingMarket(s=>M.handleCollection(s,user,id,'sell',now),storage)));
        expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(M.readFishingMarketState(storage).inventory).toHaveLength(1);
        expect(M.readFishingMarketState(storage).accounts.user).toBe(128);
        } finally { clock.mockRestore(); }
    });
    it('wallet limit blocks the entire incoming transfer, while old large balances remain spendable',()=>{
        let state=init();state.accounts.aran=SAR_WALLET_LIMIT;
        state=M.createListing(state,char,null,10,'',now,'旧便笺');const before=JSON.stringify(state);
        expect(()=>M.buyListing(state,state.listings[0].id,user,now)).toThrow('钱包最多');expect(JSON.stringify(state)).toBe(before);
        state.accounts.aran=SAR_WALLET_LIMIT+10;state=M.createListing(state,user,null,20,'',now,'回应');
        expect(M.buyListing(state,state.listings[1].id,char,now).accounts.aran).toBe(SAR_WALLET_LIMIT-10);
    });
    it('a storage failure cannot grant system income or erase the item',async()=>{
        const storage=memory(M.addCatchToState(init(),caught('a')));const before=storage.getItem(M.FISHING_MARKET_STORAGE_KEY);
        const broken={...storage,setItem:()=>{throw Error('quota');}};
        await expect(M.mutateFishingMarket(s=>M.handleCollection(s,user,'a','sell',now),broken)).rejects.toThrow('quota');expect(storage.getItem(M.FISHING_MARKET_STORAGE_KEY)).toBe(before);
    });
    it('rejects corrupt balances, budgets and character bags without overwriting them',()=>{
        for(const patch of [{accounts:{user:-1}},{buybackBudgets:{user:{day:sarEconomyDay(now),earned:-1}}},{sarCharacterModules:{aran:{x:1.5}}}]){
            const storage=memory({...init(),...patch} as M.FishingMarketState);expect(()=>M.readFishingMarketState(storage)).toThrow();expect(collectSARLocalBackup(storage).fishingMarketRaw).toBe(storage.getItem(M.FISHING_MARKET_STORAGE_KEY));
        }
    });
});
describe('character commerce and warehouse ownership',()=>{
    it('buys once from the character wallet, stores their item and never modifies the user bag',async()=>{
        const state=init();state.sarCommerce={gacha:{version:1,collection:{'story-01':2},history:[],freeDrawDate:{}},moduleShop:createSARModuleShopState()};
        const storage=memory(state),module=SAR_MODULE_CATALOG[0];
        await acquireCharacterModule(char,module.id,'purchase-1',storage,now);await acquireCharacterModule(char,module.id,'purchase-1',storage,now);
        const paid=M.readFishingMarketState(storage);expect(paid.accounts).toEqual({user:120,aran:120-module.price});expect(paid.sarCommerce).toEqual(state.sarCommerce);
        expect(paid.sarCharacterModules?.aran[module.id]).toBe(1);expect(paid.ledger).toHaveLength(1);
        await acquireCharacterModule(char,module.id,'another-visit',storage,now);expect(M.readFishingMarketState(storage).accounts).toEqual(paid.accounts);
        await consumeCharacterModule(char.id,module.id,storage);await acquireCharacterModule(char,module.id,'purchase-1',storage,now);
        expect(M.readFishingMarketState(storage).sarCharacterModules?.aran[module.id]).toBe(0);
        await expect(consumeCharacterModule(char.id,module.id,storage)).rejects.toThrow('没有');
        await expect(acquireCharacterModule({...char,id:'other'},module.id,'purchase-1',storage,now)).rejects.toThrow('不匹配');
    });
    it('parallel character purchases obey a combined 60 daily budget and leave a 30 reserve',async()=>{
        const storage=memory();const results=await Promise.allSettled(SAR_MODULE_CATALOG.slice(0,5).map((m,i)=>acquireCharacterModule(char,m.id,`buy-${i}`,storage,now)));
        const state=M.readFishingMarketState(storage);const paid=120-state.accounts.aran;expect(paid).toBeLessThanOrEqual(60);expect(paid).toBeGreaterThan(0);expect(results.some(r=>r.status==='rejected')).toBe(true);expect(state.accounts.user).toBe(120);
        const poor=memory({...init(),accounts:{user:1000,aran:40}});await expect(acquireCharacterModule(char,SAR_MODULE_CATALOG[0].id,'poor',poor,now)).rejects.toThrow('预算');
        expect(characterModuleAllowance(state,char,now+M.MARKET_DAY_MS)).toBe(Math.min(60,state.accounts.aran-30));
        expect(characterModuleAllowance(state,char,now-M.MARKET_DAY_MS)).toBe(characterModuleAllowance(state,char,now));
    });
    it('failed character payment leaves their balance and bag unchanged',async()=>{
        const storage=memory(),before=storage.getItem(M.FISHING_MARKET_STORAGE_KEY);
        await expect(acquireCharacterModule(char,SAR_MODULE_CATALOG[0].id,'fail',{...storage,setItem:()=>{throw Error('quota');}},now)).rejects.toThrow();
        expect(storage.getItem(M.FISHING_MARKET_STORAGE_KEY)).toBe(before);
    });
    it('warehouse uses current ownership, retains listed items, and does not copy user chips into character bags',()=>{
        let state=init();state.sarCommerce={gacha:{version:1,collection:{'story-01':3},history:[],freeDrawDate:{}},moduleShop:createSARModuleShopState()};
        state=M.addCatchToState(state,{...caught('transferred',char),origin:{kind:'fished',actorId:'user',at:now}});
        state=M.createListing(state,char,state.inventory[0],10,'',now);
        expect(sarWarehouseItems(state,'user',now).map(i=>i.id)).toEqual(['story-01']);
        expect(sarWarehouseItems(state,char.id,now)).toMatchObject([{id:'transferred',status:'挂板中',count:1}]);
        expect(sarWarehouseItems(state,'empty',now)).toEqual([]);
    });
    it('backup roundtrip preserves personal wallets, buyback budgets and character modules',async()=>{
        let state=init();state.buybackBudgets={user:{day:sarEconomyDay(now),earned:180}};
        const storage=memory(state);await acquireCharacterModule(char,SAR_MODULE_CATALOG[0].id,'buy',storage,now);
        const snapshot=M.readFishingMarketState(storage),backup=collectSARLocalBackup(storage),restored=memory();restoreSARLocalBackup(backup,{replaceMissing:true},restored);
        expect(M.readFishingMarketState(restored)).toEqual(snapshot);
    });
});
