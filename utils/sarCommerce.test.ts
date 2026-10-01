import { describe, expect, it } from 'vitest';
import { buySARModuleWithPayment, consumeOwnedSARModule, drawSARModuleWithPayment, ensureSARCommerce, readSARCommerce, refreshSARModuleShelf } from './vrWorld/sarCommerce';
import { createFishingMarketState, FISHING_MARKET_STORAGE_KEY, readFishingMarketState } from './vrWorld/fishingMarket';
import { SAR_GACHA_STORAGE_KEY, readSARGachaState } from './vrWorld/sarGacha';
import { createSARModuleShopState, getSARModuleById, readSARModuleShopState, SAR_MODULE_CATALOG, SAR_MODULE_SHOP_STORAGE_KEY } from './vrWorld/sarModuleShop';
import { collectSARLocalBackup, restoreSARLocalBackup } from './vrWorld/sarBackup';

const now = new Date(2026, 8, 10, 12);
const memory = () => {
    const values = new Map<string, string>();
    return { getItem: (key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value);}, removeItem:(key:string)=>{values.delete(key);} };
};
const seed = (balance=1000) => {
    const storage=memory();
    storage.setItem(FISHING_MARKET_STORAGE_KEY,JSON.stringify({...createFishingMarketState(12),accounts:{user:balance,friend:500}}));
    storage.setItem(SAR_MODULE_SHOP_STORAGE_KEY,JSON.stringify(createSARModuleShopState(now,()=>.2)));
    return storage;
};
const quote = (storage:ReturnType<typeof memory>,requestId:string,maxCost=90,date=now)=>({storage,requestId,maxCost,now:date,random:()=>0});

describe('SAR 鳞币结算',()=>{
    it('migrates old collections once without resetting or charging existing assets',async()=>{
        const storage=seed();
        storage.setItem(SAR_GACHA_STORAGE_KEY,JSON.stringify({version:1,collection:{'story-01':4},freeDrawDate:{story:'2026-09-10'},history:[]}));
        const shop=readSARModuleShopState(storage,now);const id=shop.market.offerIds[0];
        storage.setItem(SAR_MODULE_SHOP_STORAGE_KEY,JSON.stringify({...shop,inventory:{[id]:1500},credits:99}));
        await ensureSARCommerce(storage,now);await ensureSARCommerce(storage,now);
        expect(readSARCommerce(storage,now)).toMatchObject({balance:1000,gacha:{collection:{'story-01':4}},shop:{inventory:{[id]:1500},credits:99}});
        storage.setItem(SAR_MODULE_SHOP_STORAGE_KEY,JSON.stringify({...shop,inventory:{[id]:9999}}));
        expect(readSARModuleShopState(storage,now).inventory[id]).toBe(1500);
    });
    it('each pool is free once, then charges 90, and resets locally the next day',async()=>{
        const storage=seed();
        expect((await drawSARModuleWithPayment('story',quote(storage,'s1',0))).paid).toBe(0);
        expect((await drawSARModuleWithPayment('variant',quote(storage,'v1',0))).paid).toBe(0);
        expect((await drawSARModuleWithPayment('story',quote(storage,'s2'))).balance).toBe(910);
        const tomorrow=new Date(2026,8,11,0,1);
        expect((await drawSARModuleWithPayment('story',quote(storage,'s3',30,tomorrow))).paid).toBe(0);
        expect(readSARGachaState(storage).collection['story-01']).toBe(3);
        expect(readFishingMarketState(storage).accounts.friend).toBe(500);
    });
    it('never upgrades a stale free offer into a paid draw',async()=>{
        const storage=seed();await drawSARModuleWithPayment('story',quote(storage,'first',0));
        const before=storage.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(drawSARModuleWithPayment('story',quote(storage,'stale',0))).rejects.toThrow('免费次数');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
    });
    it('rejects old 30-coin quotes without charging or advancing duplicate protection',async()=>{
        const storage=seed();await drawSARModuleWithPayment('story',quote(storage,'first',0));
        const before=storage.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(drawSARModuleWithPayment('story',quote(storage,'old-price',30))).rejects.toThrow('价格');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
    });
    it('duplicate protection survives retries, backup and restore; failed protected draws do not consume it',async()=>{
        const storage=seed();
        await drawSARModuleWithPayment('story',quote(storage,'first',0));
        await drawSARModuleWithPayment('story',quote(storage,'second'));
        await drawSARModuleWithPayment('story',quote(storage,'third'));
        await drawSARModuleWithPayment('story',quote(storage,'third'));
        const restored=memory();restoreSARLocalBackup(collectSARLocalBackup(storage),{replaceMissing:true},restored);
        expect(readSARCommerce(restored,now)).toMatchObject({balance:820,gacha:{duplicateStreak:{story:2}}});
        const before=restored.getItem(FISHING_MARKET_STORAGE_KEY);
        const broken={getItem:restored.getItem,setItem:()=>{throw new Error('quota');}};
        await expect(drawSARModuleWithPayment('story',{...quote(restored,'protected'),storage:broken})).rejects.toThrow('quota');
        expect(restored.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
        const protectedDraw=await drawSARModuleWithPayment('story',quote(restored,'protected'));
        expect(protectedDraw).toMatchObject({balance:730,firstCopy:true,paid:90,module:{id:'story-02'},gacha:{duplicateStreak:{story:0}}});
        await drawSARModuleWithPayment('story',quote(restored,'protected'));
        expect(readSARCommerce(restored,now)).toMatchObject({balance:730,gacha:{duplicateStreak:{story:0}}});
    });
    it('zero balance still gets a daily free draw but cannot spend',async()=>{
        const storage=seed(0);await drawSARModuleWithPayment('story',quote(storage,'free',0));
        await expect(drawSARModuleWithPayment('story',quote(storage,'paid'))).rejects.toThrow('不足');
        const id=readSARCommerce(storage,now).shop.market.offerIds[0];
        await expect(buySARModuleWithPayment(id,quote(storage,'module',100))).rejects.toThrow('不足');
        expect(readSARCommerce(storage,now).balance).toBe(0);
    });
    it('serializes simultaneous spending and prevents negative balances',async()=>{
        const storage=seed(90);await drawSARModuleWithPayment('story',quote(storage,'free',0));
        const results=await Promise.allSettled(Array.from({length:10},(_,i)=>drawSARModuleWithPayment('story',quote(storage,`paid-${i}`))));
        expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
        expect(readSARCommerce(storage,now)).toMatchObject({balance:0,gacha:{collection:{'story-01':2}}});
    });
    it('replaying an order grants and charges only once',async()=>{
        const storage=seed();await ensureSARCommerce(storage,now);
        const id=readSARCommerce(storage,now).shop.market.offerIds[0];const price=getSARModuleById(id)!.price;
        await Promise.all([buySARModuleWithPayment(id,quote(storage,'same',price)),buySARModuleWithPayment(id,quote(storage,'same',price))]);
        const state=readSARCommerce(storage,now);expect(state.balance).toBe(1000-price);expect(state.shop.inventory[id]).toBe(1);
        expect(state.market.ledger.filter(e=>e.id==='same')).toHaveLength(1);
        await expect(drawSARModuleWithPayment('story',quote(storage,'same'))).rejects.toThrow('不匹配');
    });
    it('rejects stale shelf items and underquoted prices',async()=>{
        const storage=seed();const state=await ensureSARCommerce(storage,now);const id=state.shop.market.offerIds[0];
        await expect(buySARModuleWithPayment(id,quote(storage,'cheap',0))).rejects.toThrow('价格');
        await expect(buySARModuleWithPayment('missing',quote(storage,'missing',100))).rejects.toThrow('不存在');
        const raw=readFishingMarketState(storage);raw.sarCommerce!.moduleShop.market.offerIds=SAR_MODULE_CATALOG.filter(module=>module.id!==id).slice(0,5).map(module=>module.id);
        storage.setItem(FISHING_MARKET_STORAGE_KEY,JSON.stringify(raw));
        await expect(buySARModuleWithPayment(id,quote(storage,'stale',100))).rejects.toThrow('货架已经更新');
        expect(readSARCommerce(storage,now).balance).toBe(1000);
    });
    it('one failing storage write leaves balance, inventory, quota and receipt untouched',async()=>{
        const storage=seed();await ensureSARCommerce(storage,now);const before=storage.getItem(FISHING_MARKET_STORAGE_KEY);
        const broken={getItem:storage.getItem,setItem:()=>{throw new Error('quota');}};
        await expect(drawSARModuleWithPayment('story',{...quote(storage,'failed',0),storage:broken})).rejects.toThrow('quota');
        const id=readSARCommerce(storage,now).shop.market.offerIds[0];
        await expect(buySARModuleWithPayment(id,{...quote(storage,'failed-buy',100),storage:broken})).rejects.toThrow('quota');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
        await drawSARModuleWithPayment('story',quote(storage,'retry',0));
        expect(readSARCommerce(storage,now).gacha.collection['story-01']).toBe(1);
    });
    it('paid inventory survives reload, consumption, backup and restore',async()=>{
        const storage=seed();const initial=await ensureSARCommerce(storage,now);const id=initial.shop.market.offerIds[0];
        await buySARModuleWithPayment(id,quote(storage,'buy',100));
        const backup=collectSARLocalBackup(storage);const restored=memory();restoreSARLocalBackup(backup,{replaceMissing:true},restored);
        expect(readSARCommerce(restored,now).shop.inventory[id]).toBe(1);
        await consumeOwnedSARModule(id,restored);
        expect(readSARModuleShopState(restored,now).inventory[id]).toBeUndefined();
        await expect(consumeOwnedSARModule(id,restored)).rejects.toThrow('已不在');
    });
    it('concurrent shelf refreshes never restore spent rerolls or erase purchases',async()=>{
        const storage=seed();const initial=await ensureSARCommerce(storage,now);const id=initial.shop.market.offerIds[0];
        await buySARModuleWithPayment(id,quote(storage,'buy',100));
        await Promise.all(Array.from({length:7},()=>refreshSARModuleShelf(storage,now)));
        expect(readSARCommerce(storage,now).shop).toMatchObject({inventory:{[id]:1},market:{rollsRemaining:0}});
    });
    it('does not overwrite unreadable legacy inventory during migration',async()=>{
        const storage=seed();storage.setItem(SAR_GACHA_STORAGE_KEY,'{broken');
        await expect(ensureSARCommerce(storage,now)).rejects.toThrow('存档无法读取');
        expect(storage.getItem(SAR_GACHA_STORAGE_KEY)).toBe('{broken');expect(readFishingMarketState(storage).sarCommerce).toBeUndefined();
    });
    it('can still back up a corrupt wallet and existing legacy inventory',()=>{
        const storage=seed();storage.setItem(FISHING_MARKET_STORAGE_KEY,'{broken');
        expect(collectSARLocalBackup(storage)).toMatchObject({fishingMarketRaw:'{broken',moduleShop:{version:1}});
    });
    it('applies a partial legacy inventory import after migration without resetting the wallet',async()=>{
        const storage=seed(42);await ensureSARCommerce(storage,now);
        const imported=createSARModuleShopState(now,()=>.3);const id=imported.market.offerIds[0];imported.inventory[id]=5;
        restoreSARLocalBackup({version:1,moduleShop:imported},{replaceMissing:false},storage);
        expect(readSARCommerce(storage,now)).toMatchObject({balance:42,shop:{inventory:{[id]:5}}});
    });
});
