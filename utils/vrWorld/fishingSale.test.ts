import { beforeEach, expect, it } from 'vitest';
import * as M from './fishingMarket';
import { AIVEN_FISH_SALE_REPLIES } from './fishingSale';
import { SAR_DAILY_BUYBACK, SAR_WALLET_LIMIT, sarEconomyDay } from './sarEconomy';
import { buildFishingTurn, parseFishingReaction } from './fishingCharacter';
import { fishingTripCard } from './fishingDelivery';
const at = new Date(2026, 8, 11, 12).getTime();
const actor: M.MarketActor = { id: 'char', name: '钓鱼的朋友', kind: 'character' };
const fish: M.FishingCatch = { id: 'fish-sale', speciesId: 'glass-minnow', ownerId: actor.id, ownerName: actor.name, caughtAt: at, weather: 'clear', weatherLabel: '晴天', weatherSource: 'simulated', quality: 3, sizeCm: 22 };
const init = () => M.addCatchToState(M.ensureMarketDay(M.ensureActorAccounts(M.createFishingMarketState(42), [actor, { id: 'user', name: '雨眠', kind: 'user' }]), at), fish);
const reaction: M.FishingReaction = { disposition: 'sell', reaction: '今天有收获。', saleWords: '这一条交给你。', shareToUser: { text: '今天把鱼卖给艾文了。' } };
beforeEach(() => localStorage.clear());
it('pays the actual daily price and quality premium, removes only the fish, and preserves discovery', () => {
    const state = init(), price = M.catchValue(state, fish);
    const { state: next, sale } = M.sellFishToAiven(state, actor, fish.id, at, reaction.saleWords);
    expect(next.accounts.char).toBe(state.accounts.char + price); expect(next.accounts.user).toBe(state.accounts.user);
    expect(next.inventory).toHaveLength(0); expect(state.inventory).toHaveLength(1);
    expect(next.collectionEntries).toEqual(state.collectionEntries);
    expect(sale.amount).toBe(price); expect(AIVEN_FISH_SALE_REPLIES[sale.replyIndex]).toBeDefined();
    expect(next.ledger.at(-1)).toMatchObject({ id: 'aiven_fish_sale_' + fish.id, quotes: [{ name: actor.name, content: reaction.saleWords }, { name: '艾文' }], aivenSale: sale });
    expect(() => M.sellFishToAiven(next, actor, fish.id, at)).toThrow();
});
it('refreshes stale prices at settlement instead of paying yesterday\'s displayed quote', () => {
    const stale = { ...init(), priceDate: '2000-1-1', prices: { 'glass-minnow': 1000 } };
    expect(M.sellFishToAiven(stale, actor, fish.id, at).sale.amount).toBe(M.catchValue(M.ensureMarketDay(stale, at), fish));
});
it('rejects quota overflow, wallet overflow, other owners and clay without consuming anything', () => {
    const state = init();
    expect(() => M.sellFishToAiven({ ...state, buybackBudgets: { char: { day: sarEconomyDay(at), earned: SAR_DAILY_BUYBACK } } }, actor, fish.id, at)).toThrow('额度');
    expect(() => M.sellFishToAiven({ ...state, accounts: { char: SAR_WALLET_LIMIT } }, actor, fish.id, at)).toThrow('钱包');
    expect(() => M.sellFishToAiven(state, { ...actor, id: 'user' }, fish.id, at)).toThrow();
    expect(() => M.sellFishToAiven({ ...state, inventory: [{ ...fish, speciesId: 'brachiosaurus' }] }, actor, fish.id, at)).toThrow('只收鱼');
    const listed = M.createListing(state, actor, fish, 2, '', at);
    expect(() => M.sellFishToAiven(listed, actor, fish.id, at)).toThrow();
    expect(state.inventory).toEqual([fish]);
});
it('settles the current fishing trip once, stores the NPC reply and delivers the actual sale in its card', () => {
    const state = { ...init(), fishingTrips: [{ catch: fish, status: 'pending' as const }] };
    expect(() => M.sellFishToAiven(state, actor, fish.id, at)).toThrow();
    const next = M.settleFishingTrip(state, actor, fish.id, reaction, at);
    expect(M.settleFishingTrip(next, actor, fish.id, reaction, at + 1)).toBe(next);
    const trip = next.fishingTrips![0], card = fishingTripCard(trip);
    expect(trip.sale).toBeDefined(); expect(card.metadata.fishing?.decision).toBe('sell');
    expect(card.content).toContain(`获得 ${trip.sale!.amount} 鳞币`); expect(card.content).toContain(reaction.saleWords);
    expect(card.content).toContain(AIVEN_FISH_SALE_REPLIES[trip.sale!.replyIndex].text);
    M.saveFishingMarketState(next); expect(M.readFishingMarketState().fishingTrips![0]).toEqual(trip);
});
it('parses the new action without accepting a model-specified price, reply or malformed words', () => {
    const parsed = parseFishingReaction(JSON.stringify({ ...reaction, amount: 99999, replyIndex: 999 }));
    expect(parsed).toEqual(reaction);
    expect(parseFishingReaction(JSON.stringify({ ...reaction, saleWords: {} }))).toBeNull();
    const prompt = buildFishingTurn(actor, fish, init(), '雨眠');
    expect(prompt).toContain('sell'); expect(prompt).toContain('saleWords'); expect(prompt).toContain('由程序选取');
});
it('rejects a sale without its actual receipt on import, while old keep/release records remain readable', () => {
    M.saveFishingMarketState({ ...init(), fishingTrips: [{ catch: fish, status: 'settled', result: reaction }] });
    expect(() => M.readFishingMarketState()).toThrow('售鱼回执');
    M.saveFishingMarketState({ ...init(), fishingTrips: [{ catch: fish, status: 'settled', result: { ...reaction, disposition: 'keep' } }] });
    expect(M.readFishingMarketState().fishingTrips).toHaveLength(1);
});
