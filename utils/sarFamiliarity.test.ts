import { describe, it, expect } from 'vitest';
import { FISHING_MARKET_STORAGE_KEY, createFishingMarketState, readFishingMarketState, rollFishingCatch, type FishingMarketState } from './vrWorld/fishingMarket';
import { ensureSARCommerce } from './vrWorld/sarCommerce';
import { SAR_MODULE_CATALOG } from './vrWorld/sarModuleShop';
import { SAR_EXPRESSIONS } from './vrWorld/sarArt';
import { FAMILIARITY_SCENES, familiarityScene } from './vrWorld/sarFamiliarity/catalog';
import { advanceFamiliarity, readyFamiliarityEvent, saveFamiliarityDraft, startFamiliarity, visitFamiliarity } from './vrWorld/sarFamiliarity/state';
import { freshFamiliarity } from './vrWorld/sarFamiliarity/storageTypes';
import { collectSARLocalBackup, restoreSARLocalBackup } from './vrWorld/sarBackup';

const now = new Date(2026,8,11,12).getTime();
const memory=()=>{const map=new Map<string,string>();return{getItem:(k:string)=>map.get(k)||null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};};
const setup=async()=>{const storage=memory();storage.setItem(FISHING_MARKET_STORAGE_KEY,JSON.stringify({...createFishingMarketState(17),sarFamiliarity:freshFamiliarity()}));await ensureSARCommerce(storage,new Date(now));return storage;};
const read=(s:ReturnType<typeof memory>)=>readFishingMarketState(s);
const write=(s:ReturnType<typeof memory>,m:FishingMarketState)=>s.setItem(FISHING_MARKET_STORAGE_KEY,JSON.stringify(m));
const offer=async(s:ReturnType<typeof memory>,id:string,nodeId?:string)=>{const scene=familiarityScene(id)!;const m=read(s);for(const required of scene.requires||[])m.sarFamiliarity!.npcs[scene.npc].completed[required]={at:now-1,flags:{}};m.sarFamiliarity!.npcs[scene.npc].offerId=id;write(s,m);await startFamiliarity(scene.npc,id,{storage:s,userName:'小雨',now,sullyId:'sully',sullyInSar:true});if(nodeId){const m=read(s);m.sarFamiliarity!.npcs[scene.npc].pending!.nodeId=nodeId;write(s,m);}};
const complete=async(s:ReturnType<typeof memory>,id:string,choice=0)=>{const scene=familiarityScene(id)!;for(let i=0;i<500;i++){const cursor=read(s).sarFamiliarity!.npcs[scene.npc].pending;if(!cursor)return;const node=scene.nodes[cursor.nodeId];await advanceFamiliarity(scene.npc,cursor,{storage:s,now,choice:node.choices?Math.min(choice,node.choices.length-1):undefined,draft:{confirmed:true,photo:{actors:[]},date:'2026/9/11'}});}throw new Error('scene failed to finish');};
describe('SAR authored personal lines',()=>{
    it('has every authored topic/event, valid reachable branches and character-specific expressions',()=>{
        expect(FAMILIARITY_SCENES).toHaveLength(84);
        expect(new Set(FAMILIARITY_SCENES.map(s=>s.id)).size).toBe(84);
        for(const npc of ['caian','aiven'] as const)for(const rank of [1,2,3]){
            expect(FAMILIARITY_SCENES.filter(s=>s.npc===npc&&s.rank===rank&&s.kind==='topic')).toHaveLength(10);
            expect(FAMILIARITY_SCENES.filter(s=>s.npc===npc&&s.rank===rank&&s.kind==='event')).toHaveLength(1);
        }
        for(const scene of FAMILIARITY_SCENES){
            const seen=new Set<string>(),visit=(id:string)=>{if(seen.has(id))return;seen.add(id);const node=scene.nodes[id];expect(node,`${scene.id}:${id}`).toBeDefined();for(const line of node.lines)if(line.speaker==='caian'||line.speaker==='aiven')expect(SAR_EXPRESSIONS[line.speaker]).toContain(line.expression||'normal');for(const reward of node.rewards||[])if(reward.kind==='module')expect(SAR_MODULE_CATALOG.some(m=>m.title===reward.title),reward.title).toBe(true);for(const next of [node.next,...(node.choices||[]).map(c=>c.next)].filter(Boolean))visit(next!);};
            visit(scene.start);expect(seen.size,scene.id).toBe(Object.keys(scene.nodes).length);
        }
    });
    it('persists a blank day across refresh, multiple tabs and a backwards clock',async()=>{
        const s=await setup();await visitFamiliarity('caian',{storage:s,userName:'小雨',now,random:()=>.99});
        await Promise.all([0,1,2].map(()=>visitFamiliarity('caian',{storage:s,userName:'小雨',now,random:()=>0})));
        expect(read(s).sarFamiliarity!.npcs.caian.offerId).toBeNull();
        await visitFamiliarity('caian',{storage:s,userName:'小雨',now:now-86400000,random:()=>0});expect(read(s).sarFamiliarity!.npcs.caian.offerId).toBeNull();
        await visitFamiliarity('caian',{storage:s,userName:'小雨',now:now+86400000,random:()=>0});expect(read(s).sarFamiliarity!.npcs.caian.offerId).toBe('C1-01');
    });
    it('restarts interrupted topics, drops draft choices, and ignores stale or duplicate advances',async()=>{
        const s=await setup();await offer(s,'C1-01');const cursor=read(s).sarFamiliarity!.npcs.caian.pending!;
        await saveFamiliarityDraft('caian',cursor,{confirmed:true,photo:{caption:'保留'}},s);
        await visitFamiliarity('caian',{storage:s,userName:'小雨',now:now+86400000,random:()=>0});
        const restarted=read(s).sarFamiliarity!.npcs.caian.pending!;
        expect(restarted.drafts).toEqual({});expect(restarted.nodeId).toBe('start');expect(restarted.line).toBe(0);
        await advanceFamiliarity('caian',cursor,{storage:s,now,choice:0});expect(read(s).sarFamiliarity!.npcs.caian.pending).toEqual(restarted);
        await Promise.all([0,1].map(()=>advanceFamiliarity('caian',restarted,{storage:s,now,choice:0})));
        expect(read(s).sarFamiliarity!.npcs.caian.pending?.nodeId).toBe('answer-1');
        expect(read(s).sarFamiliarity!.npcs.caian.pending?.revision).toBe(restarted.revision+1);
        await complete(s,'C1-01');await visitFamiliarity('caian',{storage:s,userName:'小雨',now:now+86400000,random:()=>0});
        expect(read(s).sarFamiliarity!.npcs.caian.offerId).not.toBe('C1-01');
    });
    it('only opens the star event after all ten topics and never invents stars 4/5',async()=>{
        const s=await setup();let m=read(s),p=m.sarFamiliarity!.npcs.caian;
        for(let n=1;n<=9;n++)p.completed[`C1-${String(n).padStart(2,'0')}`]={at:now,flags:{}};
        expect(readyFamiliarityEvent(m.sarFamiliarity!,'caian')).toBeUndefined();p.completed['C1-10']={at:now,flags:{}};write(s,m);
        const visited=await visitFamiliarity('caian',{storage:s,userName:'小雨',now,random:()=>.99});expect(visited.sarFamiliarity!.npcs.caian.offerId).toBe('C1-SPECIAL');
        m=read(s);m.sarFamiliarity!.npcs.caian.stars=3;write(s,m);expect(readyFamiliarityEvent(m.sarFamiliarity!,'caian')).toBeUndefined();
    });
    it('all authored scene routes complete and first-run rewards survive without duplicate grants',async()=>{
        for(const scene of FAMILIARITY_SCENES){const s=await setup();await offer(s,scene.id);await complete(s,scene.id);const before=read(s);expect(before.sarFamiliarity!.npcs[scene.npc].completed[scene.id]).toBeDefined();await expect(startFamiliarity(scene.npc,scene.id,{storage:s,userName:'小雨',now})).rejects.toThrow('还没有发生');expect(read(s).sarFamiliarity!.applied).toEqual(before.sarFamiliarity!.applied);}
    });
    it('coupon rain grants once under races, without adding a second confirmation',async()=>{
        const s=await setup(),scene=familiarityScene('A2-E03')!;await offer(s,scene.id,'rain');const cursor=read(s).sarFamiliarity!.npcs.aiven.pending!;
        await Promise.all([0,1,2].map(()=>advanceFamiliarity('aiven',cursor,{storage:s,now,draft:{confirmed:true}})));
        expect(read(s).sarFamiliarity!.coupons).toHaveLength(0);
        await complete(s,scene.id);expect(read(s).sarFamiliarity!.coupons).toHaveLength(3);
        await advanceFamiliarity('aiven',cursor,{storage:s,now});expect(read(s).sarFamiliarity!.coupons).toHaveLength(3);
    });
    it('membership needs a deliberate confirmation before saving the keepsake',async()=>{
        const s=await setup();await offer(s,'C1-SPECIAL','member-card');const cursor=read(s).sarFamiliarity!.npcs.caian.pending!;
        await expect(advanceFamiliarity('caian',cursor,{storage:s,now})).rejects.toThrow('确认');expect(read(s).sarFamiliarity!.souvenirs).toHaveLength(0);
    });
    it('module gift, journal and cursor roll back together on storage failure',async()=>{
        const s=await setup();await offer(s,'A1-E02');const c=read(s).sarFamiliarity!.npcs.aiven.pending!;await advanceFamiliarity('aiven',c,{storage:s,now});const cursor=read(s).sarFamiliarity!.npcs.aiven.pending!,before=s.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(advanceFamiliarity('aiven',cursor,{now,storage:{getItem:s.getItem,setItem:()=>{throw new Error('quota');}}})).rejects.toThrow('quota');expect(s.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
        await advanceFamiliarity('aiven',cursor,{storage:s,now});const m=read(s),module=SAR_MODULE_CATALOG.find(m=>m.title==='关键词消音器')!;expect(m.sarCommerce!.moduleShop.inventory[module.id]).toBe(1);expect(m.sarCollection!.actors.user.modules).toContain(module.id);
    });
    it('egg and chimera are genuine personal gifts and never randomly fished',async()=>{
        const s=await setup();await offer(s,'A3-02');await complete(s,'A3-02');await offer(s,'A3-SPECIAL');await complete(s,'A3-SPECIAL');
        const m=read(s);expect(m.inventory.some(c=>c.speciesId==='dinosaur-egg'&&c.ownerId==='user')).toBe(true);expect(m.inventory.filter(c=>c.speciesId==='aiven-chimera')).toHaveLength(1);expect(m.collectionEntries!.some(e=>e.speciesId==='aiven-chimera')).toBe(true);
        for(let i=0;i<3000;i++){const caught=rollFishingCatch({id:'user',name:'我'},{kind:'rain',label:'雨',detail:'',source:'simulated'},()=>i/3000,now);expect(['dinosaur-egg','aiven-chimera']).not.toContain(caught.speciesId);}
    });
    it('backs up scene cursors, souvenirs and coupons, and rejects damaged progress without resetting',async()=>{
        const s=await setup();await offer(s,'C2-SPECIAL');await complete(s,'C2-SPECIAL');const out=memory();restoreSARLocalBackup(collectSARLocalBackup(s),{replaceMissing:true},out);expect(read(out).sarFamiliarity).toEqual(read(s).sarFamiliarity);
        const m=read(s);m.sarFamiliarity!.npcs.caian.stars=9;write(s,m);const before=s.getItem(FISHING_MARKET_STORAGE_KEY);expect(()=>read(s)).toThrow('名册');expect(s.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
    });
});
