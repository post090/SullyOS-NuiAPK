import { describe, expect, it } from 'vitest';
import { createFishingMarketState, FISHING_MARKET_STORAGE_KEY, readFishingMarketState } from './vrWorld/fishingMarket';
import { familiarityScene } from './vrWorld/sarFamiliarity/catalog';
import { advanceFamiliarity, familiarityDay, readyFamiliarityEvent, startFamiliarity, visitFamiliarity } from './vrWorld/sarFamiliarity/state';
import type { FamiliarityNpc } from './vrWorld/sarFamiliarity/types';
import { SAR_MODULE_CATALOG } from './vrWorld/sarModuleShop';

const origin = new Date(2026, 8, 11, 12).getTime();
const day = 86_400_000;
const memory = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
type TestStore = ReturnType<typeof memory>;
const setup = () => {
    const storage = memory();
    storage.setItem(FISHING_MARKET_STORAGE_KEY, JSON.stringify(createFishingMarketState(27)));
    return storage;
};
const read = (storage: TestStore) => readFishingMarketState(storage);
const progress = (storage: TestStore, npc: FamiliarityNpc = 'aiven') => read(storage).sarFamiliarity!.npcs[npc];
const visit = (storage: TestStore, at: number, random = () => .7, npc: FamiliarityNpc = 'aiven') => visitFamiliarity(npc, { storage, now: at, userName: '小雨', random });
const startOffer = async (storage: TestStore, at: number, npc: FamiliarityNpc = 'aiven') => {
    const id = progress(storage, npc).offerId;
    expect(id).toBeTruthy();
    return startFamiliarity(npc, id!, { storage, now: at, userName: '小雨' });
};
const step = async (storage: TestStore, at: number, npc: FamiliarityNpc = 'aiven', choose = 0) => {
    const cursor = progress(storage, npc).pending!;
    const node = familiarityScene(cursor.sceneId)!.nodes[cursor.nodeId];
    return advanceFamiliarity(npc, cursor, { storage, now: at, choice: node.choices ? Math.min(choose, node.choices.length - 1) : undefined, draft: { confirmed: true } });
};
const finish = async (storage: TestStore, at: number, npc: FamiliarityNpc = 'aiven', choose = 0) => {
    for (let i = 0; i < 500; i++) { if (!progress(storage, npc).pending) return; await step(storage, at, npc, choose); }
    throw new Error('The authored scene did not terminate');
};
/** Obtain state only through real visits and choices, never by seeding an impossible cursor. */
const reachEvent = async (storage: TestStore, rank: number, startAt = origin) => {
    let at = startAt;
    for (let i = 0; i < 100; i++, at += day) {
        await visit(storage, at);
        const p = progress(storage);
        const scene = p.offerId ? familiarityScene(p.offerId)! : undefined;
        if (!scene) continue;
        if (scene.kind === 'event' && scene.rank === rank) return at;
        await startOffer(storage, at);
        await finish(storage, at);
        const ready = readyFamiliarityEvent(read(storage).sarFamiliarity!, 'aiven');
        if (ready?.rank === rank) {
            expect(progress(storage).offerId).toBeNull();expect(progress(storage).pending).toBeUndefined();
            await expect(startFamiliarity('aiven',ready.id,{storage,now:at,userName:'小雨'})).rejects.toThrow('还没有发生');
            await visit(storage, at); return at;
        }
        if (ready) { await visit(storage, at); await startOffer(storage, at); await finish(storage, at); }
    }
    throw new Error(`Rank ${rank} did not become available`);
};

describe('SAR personal line production paths and boundaries', () => {
    it('offers at most one new daily topic, even after completing and reopening it in several tabs', async () => {
        const storage = setup();
        await Promise.all([visit(storage, origin), visit(storage, origin, () => 0), visit(storage, origin, () => .99)]);
        const offered = progress(storage).offerId!;
        await startOffer(storage, origin);
        await finish(storage, origin);
        await Promise.all([visit(storage, origin, () => 0), visit(storage, origin, () => 0)]);
        expect(progress(storage).offerId).toBeNull();
        expect(Object.keys(progress(storage).completed)).toEqual([offered]);
        expect(progress(storage).day).toBe(familiarityDay(origin));
        await visit(storage, origin + day);
        expect(progress(storage).offerId).not.toBe(offered);
    });
    it('keeps a non-trigger day quiet while allowing the other character an independent daily topic', async () => {
        const storage = setup();
        await visit(storage, origin, () => .99);
        await visit(storage, origin, () => 0);
        await visit(storage, origin, () => 0, 'caian');
        expect(progress(storage).offerId).toBeNull();
        expect(progress(storage, 'caian').offerId).toBe('C1-01');
    });
    it.each(['aiven', 'caian'] as const)('%s checks Sully presence again at start and makes the encounter one-time after completion', async (npc) => {
        const encounter = npc === 'caian' ? 'C-SULLY' : 'A-SULLY';
        const topic = npc === 'caian' ? 'C1-01' : 'A1-01';
        const storage = setup();
        const opts = { storage, now: origin, userName: '小雨', sullyId: 'sully-local', sullyInSar: true, random: () => 0 };
        await visitFamiliarity(npc, opts);
        expect(progress(storage, npc).offerId).toBe(topic);
        expect(progress(storage, npc).queuedSceneIds).toContain(encounter);
        await startOffer(storage,origin,npc);await finish(storage,origin,npc);await visitFamiliarity(npc,opts);
        expect(progress(storage, npc).offerId).toBe(encounter);
        const before = storage.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(startFamiliarity(npc, encounter, { ...opts, sullyInSar: false })).rejects.toThrow('Sully');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
        await startFamiliarity(npc, encounter, opts);
        // Walking away after the conversation started does not cancel an already witnessed meeting.
        await visitFamiliarity(npc, { ...opts, sullyInSar: false, now: origin + day });
        expect(progress(storage, npc).pending?.sceneId).toBe(encounter);
        await finish(storage, origin + day,npc);
        await visitFamiliarity(npc, { ...opts, now: origin + day });
        expect(progress(storage, npc).offerId).not.toBe(encounter);
    });
    it('starts the star event on the next visit and restarts interruptions without lighting the star', async () => {
        const storage = setup();
        const at = await reachEvent(storage, 1);
        expect(Object.keys(progress(storage).completed)).toHaveLength(10);
        expect(progress(storage).stars).toBe(0);
        await startOffer(storage, at);
        await step(storage, at);
        const paused = structuredClone(progress(storage).pending);
        await visit(storage, at + day * 3);
        expect(progress(storage).pending).toMatchObject({sceneId:paused!.sceneId,nodeId:familiarityScene(paused!.sceneId)!.start,line:0,flags:{},drafts:{}});
        expect(progress(storage).pending?.revision).toBe(paused!.revision+1);
        expect(progress(storage).stars).toBe(0);
        await finish(storage, at + day * 3);
        expect(progress(storage).stars).toBe(1);
        expect(progress(storage).completed['A1-SPECIAL']).toBeDefined();
        const cat = SAR_MODULE_CATALOG.find(module => module.title === '猫科语法包')!;
        expect(read(storage).sarCommerce!.moduleShop.inventory[cat.id]).toBe(1);
        expect(read(storage).sarCharacterModules?.aiven?.[cat.id]).toBeUndefined();
        await expect(startFamiliarity('aiven', 'A1-SPECIAL', { storage, now: at + day * 3, userName: '小雨' })).rejects.toThrow('还没有发生');
    });
    it('refusing a reply or submitting a wrong character never advances or awards', async () => {
        const storage = setup();
        await visit(storage, origin, () => 0);
        await startOffer(storage, origin);
        const cursor = progress(storage).pending!;
        const before = storage.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(advanceFamiliarity('aiven', cursor, { storage, now: origin })).rejects.toThrow('请选择');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
        await expect(startFamiliarity('caian', 'A1-01', { storage, userName: '小雨' })).rejects.toThrow('还没有发生');
        const current = progress(storage).pending!;
        await Promise.all([step(storage, origin), advanceFamiliarity('aiven', current, { storage, now: origin, choice: 0 })]);
        expect(progress(storage).pending?.revision).toBe(cursor.revision + 1);
    });
    it('settles gifts and timed discounts only after an uninterrupted completion', async () => {
        const storage=setup(),at=await reachEvent(storage,2);
        await startOffer(storage,at);
        for(let i=0;i<100&&progress(storage).pending?.nodeId!=='title';i++)await step(storage,at);
        expect(progress(storage).pending?.nodeId).toBe('title');
        expect(read(storage).sarFamiliarity!.discounts).toHaveLength(0);
        await step(storage,at);await step(storage,at);
        expect(read(storage).sarFamiliarity!.titles).not.toContain('听懂风的人');
        expect(progress(storage).stars).toBe(1);
        await visit(storage,at+day);
        expect(progress(storage).pending?.nodeId).toBe(familiarityScene('A2-SPECIAL')!.start);
        expect(read(storage).sarFamiliarity!.discounts).toHaveLength(0);
        await finish(storage,at+day);
        const state=read(storage).sarFamiliarity!;
        expect(state.npcs.aiven.stars).toBe(2);
        expect(state.titles).toContain('听懂风的人');
        expect(state.unlocks).toEqual(expect.arrayContaining(['titles','environment']));
        expect(state.discounts).toHaveLength(1);
        expect(state.discounts[0].expiresAt).toBe(at+day+30*60_000);
    });
    it('rolls Aiven easters independently of topics and keeps both across repeated visits',async()=>{
        for(const [rolls,wantTopic,wantEaster] of [
            [[0,0,0,0],true,true], [[.99,0,0],false,true], [[0,0,.99],true,false], [[.99,.99],false,false],
        ] as Array<[number[],boolean,boolean]>){
            const storage=setup(),at=await reachEvent(storage,1);
            await startOffer(storage,at);await finish(storage,at);
            await visit(storage,at+day,()=>rolls.shift()??.99);
            const first=progress(storage).offerId,queue=progress(storage).queuedSceneIds||[];
            const scenes=[first,...queue].filter(Boolean).map(id=>familiarityScene(id!)!);
            expect(scenes.some(s=>s.kind==='topic')).toBe(wantTopic);
            expect(scenes.some(s=>s.kind==='easter')).toBe(wantEaster);
            if(first){await startOffer(storage,at+day);await finish(storage,at+day);}
            await visit(storage,at+day,()=>0);
            const second=progress(storage).offerId;
            expect(!!second).toBe(wantTopic&&wantEaster);
            if(second){expect(familiarityScene(second)?.kind).toBe('easter');await startOffer(storage,at+day);await finish(storage,at+day);}
            await visit(storage,at+day,()=>0);expect(progress(storage).offerId).toBeNull();
        }
    });
    it('keeps the third-star loot heap as scenery and grants only the specified unique gifts to the user', async () => {
        const storage = setup();
        const at = await reachEvent(storage, 3);
        expect(progress(storage).stars).toBe(2);
        expect(read(storage).inventory.filter(c => c.speciesId === 'dinosaur-egg' && c.ownerId === 'user')).toHaveLength(1);
        expect(read(storage).sarFamiliarity!.unlocks).toContain('eggs');
        await startOffer(storage, at);
        for (let i = 0; i < 20 && progress(storage).pending?.nodeId !== 'loot'; i++) await step(storage, at);
        expect(progress(storage).pending?.nodeId).toBe('loot');
        const before = read(storage), cursor = progress(storage).pending!;
        await advanceFamiliarity('aiven', cursor, { storage, now: at, choice: 0 });
        const afterHeap = read(storage);
        expect(afterHeap.inventory).toEqual(before.inventory);
        expect(afterHeap.sarCommerce?.moduleShop.inventory).toEqual(before.sarCommerce?.moduleShop.inventory);
        expect(afterHeap.sarFamiliarity!.coupons).toEqual(before.sarFamiliarity!.coupons);
        await finish(storage, at);
        const final = read(storage);
        expect(final.sarFamiliarity!.souvenirs.filter(s => s.id === 'aiven-backup-card')).toHaveLength(1);
        expect(final.inventory.filter(c => c.speciesId === 'aiven-chimera' && c.ownerId === 'user')).toHaveLength(1);
        expect(final.sarFamiliarity!.unlocks).toContain('cross-system');
        expect(progress(storage).stars).toBe(3);
        expect(readyFamiliarityEvent(final.sarFamiliarity!, 'aiven')).toBeUndefined();
    });
    it('makes the cross-system Sully scene only a one-time local message, without granting a cat or fake item', async () => {
        const storage = setup();
        const at = await reachEvent(storage, 3);
        await startOffer(storage, at); await finish(storage, at);
        const rolls = [0, .999], nextDay = at + day;
        await visitFamiliarity('aiven', { storage, now: nextDay, userName: '小雨', sullyId: 'preset-sully-v2', sullyInSar: false, random: () => rolls.shift() ?? 0 });
        expect(progress(storage).offerId).toBe('A3-E06');
        await startFamiliarity('aiven', 'A3-E06', { storage, now: nextDay, userName: '小雨', sullyId: 'preset-sully-v2' });
        const before = read(storage);
        await step(storage, nextDay); await step(storage, nextDay);
        const cursor = progress(storage).pending!;
        await Promise.all([advanceFamiliarity('aiven', cursor, { storage, now: nextDay }), advanceFamiliarity('aiven', cursor, { storage, now: nextDay })]);
        const after = read(storage);
        expect(after.sarFamiliarity!.outbox).toHaveLength(1);
        expect(after.sarFamiliarity!.outbox[0]).toMatchObject({ charId: 'preset-sully-v2', text: expect.stringContaining('放我回去！！！') });
        expect(after.inventory).toEqual(before.inventory);
        expect(after.sarCommerce).toEqual(before.sarCommerce);
        expect(after.sarFamiliarity!.titles).toEqual(before.sarFamiliarity!.titles);
        expect(after.sarFamiliarity!.coupons).toEqual(before.sarFamiliarity!.coupons);
        await visitFamiliarity('aiven', { storage, now: nextDay + day, userName: '小雨', sullyId: 'preset-sully-v2', random: () => 0 });
        expect(progress(storage).offerId).not.toBe('A3-E06');
    });
});

it('requires the first paper story before the changed paper, including old queued/offered/pending saves', async () => {
    for (const mode of ['offer','queue','pending'] as const) {
        const storage=setup();await visit(storage,origin,()=>.99);
        const market=read(storage),p=market.sarFamiliarity!.npcs.aiven;p.stars=1;
        if(mode==='offer')p.offerId='A1-E07';
        if(mode==='queue')p.queuedSceneIds=['A1-E07'];
        if(mode==='pending')p.pending={sceneId:'A1-E07',nodeId:'start',line:0,runId:'old',revision:0,startedAt:origin,flags:{},drafts:{},userName:'小雨'};
        storage.setItem(FISHING_MARKET_STORAGE_KEY,JSON.stringify(market));
        if(mode==='offer')await expect(startFamiliarity('aiven','A1-E07',{storage,now:origin,userName:'小雨'})).rejects.toThrow('前一段');
        await visit(storage,origin,()=>.99);
        expect(progress(storage).offerId).not.toBe('A1-E07');expect(progress(storage).pending).toBeUndefined();
        const ready=read(storage);ready.sarFamiliarity!.npcs.aiven.completed['A1-E06']={at:origin,flags:{}};storage.setItem(FISHING_MARKET_STORAGE_KEY,JSON.stringify(ready));
        await visit(storage,origin,()=>.99);expect(progress(storage).offerId).toBe('A1-E07');
        await startOffer(storage,origin);await finish(storage,origin);expect(progress(storage).completed['A1-E07']).toBeDefined();
    }
});

 it('guarantees Caian Sully encounter after an earlier empty day, without rerolling topics or duplicating completion', async () => {
    const storage=setup(), opts={storage,now:origin,userName:'测试',random:()=>.99};
    await visitFamiliarity('caian',opts);
    expect(progress(storage,'caian').offerId).toBeNull();
    await visitFamiliarity('caian',{...opts,sullyInSar:true,sullyId:'preset-sully-v2'});
    expect(progress(storage,'caian').offerId).toBe('C-SULLY');
    await startFamiliarity('caian','C-SULLY',{...opts,sullyInSar:true});
    await finish(storage,origin,'caian');
    await visitFamiliarity('caian',{...opts,sullyInSar:true});
    expect(progress(storage,'caian').offerId).toBeNull();
    expect(progress(storage,'caian').queuedSceneIds).not.toContain('C-SULLY');
 });
 it('queues guaranteed Caian encounter behind an unfinished topic and waits if Sully leaves', async () => {
    const storage=setup(), opts={storage,now:origin,userName:'测试',random:()=>0};
    await visitFamiliarity('caian',opts);await startOffer(storage,origin,'caian');
    await visitFamiliarity('caian',{...opts,sullyInSar:true});
    expect(progress(storage,'caian').pending?.sceneId).toBe('C1-01');
    expect(progress(storage,'caian').queuedSceneIds).toEqual(['C-SULLY']);
    await finish(storage,origin,'caian');
    await visitFamiliarity('caian',opts);
    expect(progress(storage,'caian').offerId).toBeNull();
    await visitFamiliarity('caian',{...opts,sullyInSar:true});
    expect(progress(storage,'caian').offerId).toBe('C-SULLY');
 });
