import { describe, expect, it } from 'vitest';
import * as M from './fishingMarket';
const a={id:'a',name:'艾文',kind:'character' as const},b={id:'b',name:'凯恩',kind:'character' as const};
const w={kind:'clear' as const,label:'晴朗',detail:'',source:'simulated' as const};
const init=()=>M.ensureActorAccounts(M.createFishingMarketState(7),[a,b]);
describe('personal collections and fishing ownership',()=>{
    it('retains lifetime discovery after release, counts repeats per actor',()=>{
        const fish=M.rollFishingCatch(a,w,()=>0);let s=M.addCatchToState(init(),fish);
        s=M.handleCollection(s,a,fish.id,'release');expect(M.personalFishingCollection(s,a.id)[0].acquisitionIds).toHaveLength(1);
        s=M.addCatchToState(s,{...fish,id:'another'});s=M.addCatchToState(s,{...fish,id:'another'});
        expect(M.personalFishingCollection(s,a.id)[0].acquisitionIds).toHaveLength(2);expect(M.personalFishingCollection(s,b.id)).toHaveLength(0);
    });
    it('buying transfers an item but preserves seller history and discovers for buyer',()=>{
        const fish=M.rollFishingCatch(a,w,()=>0);let s=M.createListing(M.addCatchToState(init(),fish),a,fish,20);
        s=M.buyListing(s,s.listings[0].id,b);expect(s.inventory[0].ownerId).toBe('b');
        expect(M.personalFishingCollection(s,'a')).toHaveLength(1);expect(M.personalFishingCollection(s,'b')).toHaveLength(1);
    });
    it('reserved catch cannot be listed, sold or settled by another actor; replay is harmless',()=>{
        let s=M.beginFishingTrip(init(),a,w,()=>0);const id=s.inventory[0].id;
        expect(M.availableCatches(s,a.id)).toHaveLength(0);expect(()=>M.createListing(s,a,s.inventory[0],10)).toThrow();
        const result={disposition:'release' as const,reaction:'放回去',shareToUser:null};
        expect(()=>M.settleFishingTrip(s,b,id,result)).toThrow();
        s=M.settleFishingTrip(s,a,id,result);expect(M.settleFishingTrip(s,a,id,result)).toBe(s);expect(s.inventory).toHaveLength(0);
    });
    it('legacy migration recovers evidenced released catches without broadcasting old discoveries',()=>{
        const fish=M.rollFishingCatch(a,w,()=>0,1000);let s=M.handleCollection(M.addCatchToState(init(),fish),a,fish.id,'release');delete s.collectionEntries;
        const restored=M.migrateFishingCollection(s);expect(restored.collectionEntries).toMatchObject([{actorId:'a',speciesId:fish.speciesId,historicalIncomplete:true,firstObtainedAt:1000}]);
        expect(restored.collectionEntries![0].announcement).toBeUndefined();expect(M.migrateFishingCollection(restored)).toBe(restored);
    });
    it('clay cannot be released even from the ordinary collection controls',()=>{
        const toy={...M.rollFishingCatch(a,w,()=>0),speciesId:'triceratops'};const s=M.addCatchToState(init(),toy);
        expect(()=>M.handleCollection(s,a,toy.id,'release')).toThrow('模型不能放生');
    });
});

it('legacy gifts preserve evidenced first recipient but never invent the next owners acquisition date',()=>{
    const toy={...M.rollFishingCatch(a,w,()=>0,1000),speciesId:'triceratops',origin:{kind:'gift' as const,actorId:'sar-evan',actorName:'艾文',at:1000}};
    let s=M.addCatchToState(init(),toy);s={...s,inventory:[{...toy,ownerId:b.id,ownerName:b.name}]};delete s.collectionEntries;
    const migrated=M.migrateFishingCollection(s);
    expect(M.personalFishingCollection(migrated,a.id)[0].firstObtainedAt).toBe(1000);
    expect(M.personalFishingCollection(migrated,b.id)[0].firstObtainedAt).toBe(0);
});
it('invalid pending-trip saves fail without replacing the original source',()=>{
    const raw=JSON.stringify({...init(),fishingTrips:[{catch:{id:'broken'},status:'settled'}]});
    expect(()=>M.readFishingMarketState({getItem:()=>raw})).toThrow('钓鱼记录');
});
