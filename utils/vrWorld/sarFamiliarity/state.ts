import { familiarityCast } from './dialogueText';
import { keepDialogueGuest } from '../sarDialogueStaging';
import { addCatchToState, FISH_CATALOG, marketHash, marketRandom, mutateFishingMarket, readFishingMarketState, simulatedFishingWeather, type FishingMarketState, type FishingWeatherKind } from '../fishingMarket';
import { ensureSARCommerce } from '../sarCommerce';
import { SAR_MODULE_CATALOG } from '../sarModuleShop';
import { rememberSARCollections } from '../sarCollectionJournal';
import type { SARStorage } from '../sarCommerceStorage';
import { FAMILIARITY_DAILY, familiarityScene, familiarityScenes, familiarityText } from './catalog';
import { freshFamiliarity, type FamiliarityCursor, type FamiliarityState } from './storageTypes';
import type { FamiliarityNpc, FamiliarityReward } from './types';

import { sarNpcContentEnabled } from '../sarNpcPreference';
export const FAMILIARITY_TOPIC_CHANCE = .8;
export const FAMILIARITY_EASTER_CHANCE = .2;
export const familiarityDay = (at = Date.now()) => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const familiarityProgress = (market: FishingMarketState, npc: FamiliarityNpc) => (market.sarFamiliarity || freshFamiliarity()).npcs[npc];
export const readyFamiliarityEvent = (state: FamiliarityState, npc: FamiliarityNpc) => {
    const p = state.npcs[npc], rank = p.stars + 1;
    if (rank > 3) return undefined;
    const scenes = familiarityScenes(npc);
    return scenes.filter(s => s.kind === 'topic' && s.rank === rank).every(s => p.completed[s.id])
        ? scenes.find(s => s.kind === 'event' && s.rank === rank && !p.completed[s.id]) : undefined;
};
type VisitOptions = { userName: string; sullyId?: string; sullyInSar?: boolean; legacyTitles?: boolean; now?: number; storage?: SARStorage; random?: () => number };
const copy = (market: FishingMarketState) => structuredClone(market);
const prepare = (market: FishingMarketState, legacyTitles = false) => {
    const next = copy(market); next.sarFamiliarity ||= freshFamiliarity();
    if (legacyTitles && !next.sarFamiliarity.unlocks.includes('titles')) next.sarFamiliarity.unlocks.push('titles');
    if (next.inventory.some(c => c.speciesId === 'dinosaur-egg') && !next.sarFamiliarity.unlocks.includes('eggs')) next.sarFamiliarity.unlocks.push('eggs');
    return next;
};
/** Rolls survive refresh; revisiting an interrupted scene starts a fresh attempt. */
export const visitFamiliarity = async (npc: FamiliarityNpc, options: VisitOptions) => {
    const storage = options.storage || localStorage, now = options.now ?? Date.now();
    if (!sarNpcContentEnabled(storage)) return readFishingMarketState(storage);
    await ensureSARCommerce(storage, new Date(now));
    return mutateFishingMarket(current => {
        if (!sarNpcContentEnabled(storage)) return current;
        const next = prepare(current, options.legacyTitles), state = next.sarFamiliarity!, p = state.npcs[npc];
        const prerequisitesMet = (id: string) => !!familiarityScene(id) && (familiarityScene(id)!.requires || []).every(required => p.completed[required]);
        const canOffer = (id: string) => prerequisitesMet(id) && (!familiarityScene(id)?.condition || options.sullyInSar);
        // Caian's one-time Sully encounter is guaranteed on presence, independent of daily rolls.
        if (npc === 'caian' && options.sullyInSar && !p.completed['C-SULLY'] && p.offerId !== 'C-SULLY' && p.pending?.sceneId !== 'C-SULLY' && !p.queuedSceneIds?.includes('C-SULLY')) {
            p.queuedSceneIds = [...(p.queuedSceneIds || []), 'C-SULLY'];
        }
        // Old queued/offered/interrupted saves must obey the same story order as a fresh roll.
        if (p.pending && !prerequisitesMet(p.pending.sceneId)) {
            p.queuedSceneIds = [...new Set([...(p.queuedSceneIds || []), p.pending.sceneId])];
            delete p.pending;
        }
        if (p.pending) {
            const previous=p.pending,scene=familiarityScene(previous.sceneId),node=scene?.nodes[previous.nodeId];
            if(!scene||scene.npc!==npc||!node||previous.line>=Math.max(1,node.lines.length))throw new Error('这段对话暂时无法继续，进度已保留');
            p.pending={runId:previous.runId,sceneId:scene.id,nodeId:scene.start,line:0,revision:previous.revision+1,startedAt:now,flags:{},drafts:{},visitedNodes:[],userName:options.userName,sullyId:options.sullyId};
            // A retried daily topic still occupies today's single topic slot.
            if(scene.kind==='topic'&&(!p.day||familiarityDay(now)>p.day))p.day=familiarityDay(now);
            return next;
        }
        const event = readyFamiliarityEvent(state, npc);
        // The next visit offers the milestone; finishing topic ten does not chain into it.
        if (event) { p.offerId = event.id; return next; }
        if(p.offerId&&!p.completed[p.offerId]){
            if(canOffer(p.offerId))return next;
            p.queuedSceneIds=[...new Set([...(p.queuedSceneIds||[]),p.offerId])];
        }
        p.offerId=null;
        p.queuedSceneIds=(p.queuedSceneIds||[]).filter(id=>!p.completed[id]);
        if(!p.queuedSceneIds.some(id => canOffer(id) && familiarityScene(id)?.kind !== 'encounter')&&(!p.day || familiarityDay(now) > p.day)) {
            p.day = familiarityDay(now); p.offerId = null;
            const scenes = familiarityScenes(npc).filter(s => !p.completed[s.id] && !p.queuedSceneIds!.includes(s.id) && (s.requires || []).every(id => p.completed[id]));
            const roll=(kind:string,pool:typeof scenes,chance:number)=>{
                const random=options.random||marketRandom(marketHash(`${next.seed}:${npc}:${p.day}:familiarity:${kind}`));
                if(pool.length&&random()<chance)p.queuedSceneIds!.push(pool[Math.min(pool.length-1,Math.floor(random()*pool.length))].id);
            };
            roll('topic',scenes.filter(s=>s.kind==='topic'&&s.rank===p.stars+1),FAMILIARITY_TOPIC_CHANCE);
            roll('easter',scenes.filter(s=>s.kind==='easter'&&s.rank<=p.stars&&(s.id!=='A3-E06'||options.sullyId)),FAMILIARITY_EASTER_CHANCE);
            if (npc !== 'caian') roll('encounter',scenes.filter(s=>s.kind==='encounter'&&options.sullyInSar),FAMILIARITY_TOPIC_CHANCE);
        }
        // A conditional encounter can wait for Sully to return without blocking other scenes.
        const ordinary=p.queuedSceneIds.findIndex(id => canOffer(id) && familiarityScene(id)?.kind === 'topic');
        const available=ordinary >= 0 ? ordinary : p.queuedSceneIds.findIndex(canOffer);
        if(available>=0)p.offerId=p.queuedSceneIds.splice(available,1)[0];
        return next;
    }, storage);
};
export const startFamiliarity = (npc: FamiliarityNpc, sceneId: string, options: VisitOptions) => mutateFishingMarket(current => {
    if (!sarNpcContentEnabled(options.storage)) return current;
    const next = prepare(current, options.legacyTitles), state = next.sarFamiliarity!, p = state.npcs[npc];
    if (p.pending) return next;
    const scene = familiarityScene(sceneId);
    if (!scene || scene.npc !== npc || p.completed[scene.id] || p.offerId !== scene.id) throw new Error('这段回忆还没有发生');
    if (!(scene.requires || []).every(id => p.completed[id])) throw new Error('先经历前一段故事，再来看看吧');
    if (scene.condition && !options.sullyInSar) throw new Error('等 Sully 回到活动室后，再来聊这件事吧');
    const now = options.now ?? Date.now();
    p.pending = { runId: `${scene.id}:${now}`, sceneId, nodeId: scene.start, line: 0, revision: 0, startedAt: now, flags: {}, drafts: {}, visitedNodes: [], userName: options.userName, sullyId: options.sullyId };
    if(scene.kind==='topic'&&(!p.day||familiarityDay(now)>p.day))p.day=familiarityDay(now);
    p.offerId = null;
    return next;
}, options.storage || localStorage);

const grant = (market: FishingMarketState, npc: FamiliarityNpc, cursor: FamiliarityCursor, reward: FamiliarityReward, key: string, now: number) => {
    const state = market.sarFamiliarity!;
    if (reward.kind === 'module') {
        const module = SAR_MODULE_CATALOG.find(m => m.title === reward.title);
        if (!module || !market.sarCommerce) throw new Error(`赠送模块「${reward.title}」暂时无法入库`);
        const bag = market.sarCommerce.moduleShop.inventory, count = (bag[module.id] || 0) + (reward.count || 1);
        if (!Number.isSafeInteger(count)) throw new Error('模块数量已达上限');
        bag[module.id] = count;
    } else if (reward.kind === 'coupon') {
        for (let i=0;i<reward.count;i++) state.coupons.push({id:`${key}:${i}`,percent:reward.percent,createdAt:now});
    } else if (reward.kind === 'discount') {
        const offers = market.sarCommerce?.moduleShop.market.offerIds || [];
        const moduleId = offers.length ? offers[marketHash(key) % offers.length] : SAR_MODULE_CATALOG[marketHash(key) % SAR_MODULE_CATALOG.length].id;
        state.discounts.push({id:key,percent:reward.percent,scope:reward.scope,...(reward.scope === 'random-module'?{moduleId}:{}),expiresAt:now+reward.minutes*60_000});
    } else if (reward.kind === 'souvenir') {
        state.souvenirs.push({id:reward.id,title:reward.title,description:familiarityText(reward.description,cursor.userName,cursor.flags)+(reward.id==='caian-photo'&&String(cursor.drafts[cursor.nodeId]?.caption||'').includes('似乎朋友们也都在！')?'\n似乎朋友们也都在！':''),npc,sceneId:cursor.sceneId,nodeId:cursor.nodeId,
            at:now,userName:cursor.userName,flags:{...cursor.flags},draft:structuredClone(cursor.drafts[cursor.nodeId] || {})});
    } else if (reward.kind === 'title') {
        if (!state.titles.includes(reward.title)) state.titles.push(reward.title);
    } else if (reward.kind === 'unlock') {
        if (!state.unlocks.includes(reward.feature)) state.unlocks.push(reward.feature);
    } else if (reward.kind === 'sully-message') {
        if (cursor.sullyId) state.outbox.push({id:key,charId:cursor.sullyId,text:reward.text,at:now});
    } else {
        const pool = FISH_CATALOG.filter(s => s.category === 'time-relic' && !['dinosaur-egg','dinosaur-fossil'].includes(s.id));
        const speciesId = reward.kind === 'egg' ? 'dinosaur-egg' : reward.speciesId || pool[marketHash(key) % pool.length].id;
        const weather = simulatedFishingWeather(market.seed, now);
        market = addCatchToState(market, {id:key,speciesId,ownerId:'user',ownerName:cursor.userName,caughtAt:now,weather:weather.kind,weatherLabel:weather.label,weatherSource:weather.source,sizeCm:12,quality:3,origin:{kind:'gift',actorId:npc,actorName:npc==='caian'?'凯恩':'艾文',at:now}});
    }
    return market;
};
export const advanceFamiliarity = async (npc: FamiliarityNpc, expected: Pick<FamiliarityCursor,'runId'|'revision'>, options: {choice?:number;draft?:Record<string,unknown>;now?:number;storage?:SARStorage} = {}) => {
    const now=options.now??Date.now();
    return mutateFishingMarket(current => {
        if (!sarNpcContentEnabled(options.storage)) return current;
        let next=prepare(current); const state=next.sarFamiliarity!,p=state.npcs[npc],cursor=p.pending;
        if (!cursor || cursor.runId!==expected.runId || cursor.revision!==expected.revision) return next;
        const scene=familiarityScene(cursor.sceneId),node=scene?.nodes[cursor.nodeId];
        if (!scene || !node) throw new Error('这段对话暂时无法继续，进度已保留');
        if (!(scene.requires || []).every(id => p.completed[id])) throw new Error('先经历前一段故事，再来看看吧');
        cursor.guestPresent=keepDialogueGuest(scene.nodes,cursor.nodeId,cursor.line,npc,cursor.guestPresent??!!cursor.cast?.[npc==='caian'?'aiven':'caian']);
        const spoken=node.lines[cursor.line];
        cursor.cast=familiarityCast(cursor.cast,spoken);
        if(spoken?.speaker==='caian'||spoken?.speaker==='aiven')cursor.speaker=spoken.speaker;
        if (options.draft) cursor.drafts[cursor.nodeId]=structuredClone(options.draft);
        if (cursor.line < node.lines.length-1) { cursor.line++;cursor.revision++;return next; }
        const choice = options.choice === undefined ? undefined : node.choices?.[options.choice];
        if (node.choices?.length && !choice) throw new Error('请选择一条回应');
        if (node.effect?.interactive && !cursor.drafts[cursor.nodeId]?.confirmed) throw new Error('先确认眼前的纪念物，再继续吧');
        cursor.visitedNodes||=[];
        if(!cursor.visitedNodes.includes(cursor.nodeId))cursor.visitedNodes.push(cursor.nodeId);
        if (choice?.flags) Object.assign(cursor.flags,choice.flags);
        const target=choice?.next||node.next;
        if (target) { if (!scene.nodes[target]) throw new Error('下一段对话尚未准备好');cursor.nodeId=target;cursor.line=0;cursor.revision++; }
        else {
            // An interrupted attempt grants nothing. Existing receipts also protect old saves.
            for(const nodeId of cursor.visitedNodes){
                const appliedKey=`${scene.id}:${nodeId}`,visited=scene.nodes[nodeId];
                if(!visited)throw new Error('这段对话的结算记录无法读取');
                if(!state.applied.includes(appliedKey)){
                    for(const [i,reward] of (visited.rewards||[]).entries())next=grant(next,npc,{...cursor,nodeId},reward,`sar_story:${appliedKey}:${i}`,now);
                    state.applied.push(appliedKey);
                }
            }
            p.completed[scene.id]={at:now,flags:{...cursor.flags}};
            if (scene.kind==='event') p.stars=Math.max(p.stars,scene.rank);
            delete p.pending;
        }
        return rememberSARCollections(next);
    },options.storage||localStorage);
};
/** A draft save doesn't advance the narrative cursor or award anything. */
export const saveFamiliarityDraft = (npc:FamiliarityNpc, expected:Pick<FamiliarityCursor,'runId'|'revision'>, draft:Record<string,unknown>, storage:SARStorage=localStorage) => mutateFishingMarket(current=>{
    const next=prepare(current),c=next.sarFamiliarity!.npcs[npc].pending;
    if(c?.runId===expected.runId&&c.revision===expected.revision)c.drafts[c.nodeId]=structuredClone(draft);
    return next;
},storage);
export const familiarityGreeting = (npc:FamiliarityNpc,market:FishingMarketState,now=Date.now(),weather?:FishingWeatherKind) => {
    const d=new Date(now),hour=d.getHours(),time=hour>=5&&hour<11?'morning':hour>=11&&hour<16?'noon':hour>=16&&hour<21?'evening':'night';
    const data=FAMILIARITY_DAILY[npc],w=weather||simulatedFishingWeather(market.seed,now).kind;
    const weatherKey=w==='clear'?'clear':['rain','storm','snow'].includes(w)?'rain':'cloudy';
    const pick=(lines:string[],salt:string)=>lines[marketHash(`${market.seed}:${familiarityDay(now)}:${npc}:${salt}`)%lines.length]||'';
    const timeLine=pick(data.time[time],time),weatherLine=pick(data.weather[weatherKey],weatherKey),weekdayLine=pick(data.weekday[d.getDay()],'weekday');
    return (npc==='aiven'?[weekdayLine,timeLine,weatherLine]:[timeLine,weatherLine,weekdayLine]).filter(Boolean);
};
/** Outbox retries after a crash; DB's delivery key makes the local Easter-egg message idempotent. */
export const deliverFamiliarityMessages = async (storage:SARStorage=localStorage) => {
    if (!sarNpcContentEnabled(storage)) return;
    const pending=readFishingMarketState(storage).sarFamiliarity?.outbox.filter(o=>!o.delivered)||[];
    if(!pending.length)return;
    const {DB}=await import('../../db');
    for(const item of pending){
        if (!sarNpcContentEnabled(storage)) return;
        await DB.saveMessageOnce(item.id,{charId:item.charId,role:'assistant',type:'text',content:`【SAR 回忆】\n${item.text}`,timestamp:item.at,metadata:{isSystem:true,sarFamiliarity:true}});
        await mutateFishingMarket(current=>{const next=prepare(current);const saved=next.sarFamiliarity!.outbox.find(o=>o.id===item.id);if(saved)saved.delivered=true;return next;},storage);
    }
};
