import { beforeEach, expect, it } from 'vitest';
import * as M from './fishingMarket';
import { applyMarketPlan, buildMarketTurn, parseMarketPlan } from './fishingCharacter';
import { SAR_DAILY_BUYBACK, SAR_WALLET_LIMIT, sarEconomyDay } from './sarEconomy';
const actor: M.MarketActor = { id: 'char', name: '朋友', kind: 'character' };
const at = new Date(2026, 8, 16, 21).getTime();
const fish: M.FishingCatch = { id: 'one', speciesId: 'glass-minnow', ownerId: actor.id, ownerName: actor.name, caughtAt: at, weather: 'clear', weatherLabel: '晴天', weatherSource: 'simulated', quality: 1, sizeCm: 22 };
const init = () => ['one', 'two', 'keep'].reduce((s, id) => M.addCatchToState(s, { ...fish, id }), M.ensureMarketDay(M.ensureActorAccounts(M.createFishingMarketState(42), [actor]), at));
beforeEach(() => localStorage.clear());
it('settles many fish as ONE transaction with ONE Aiven reply and the sum of market prices', () => {
    const state = init(), original = JSON.stringify(state);
    const next = M.sellFishBatchToAiven(state, actor, ['one', 'two'], at, '这两条一起卖。');
    const total = M.catchValue(state, state.inventory[0]) + M.catchValue(state, state.inventory[1]);
    expect(next.accounts.char).toBe(state.accounts.char + total);
    expect(next.inventory.map(c => c.id)).toEqual(['keep']);
    expect(next.collectionEntries).toEqual(state.collectionEntries);
    expect(next.ledger).toHaveLength(state.ledger.length + 1);
    expect(next.ledger.at(-1)?.quotes?.filter(q => q.name === '艾文')).toHaveLength(1);
    expect(next.ledger.at(-1)?.aivenSale?.amount).toBe(total);
    expect(next.ledger.at(-1)?.text).toContain('2 条鱼');
    expect(next.buybackBudgets?.char.earned).toBe(total);
    expect(JSON.stringify(state)).toBe(original);
    expect(() => M.sellFishBatchToAiven(next, actor, ['one', 'two'], at)).toThrow();
});
it('rejects the entire batch on stale inventory, other owners, clay, pending trips, listings or duplicate ids', () => {
    const state = init();
    const invalids = [
        state,
        { ...state, inventory: state.inventory.map(c => c.id === 'two' ? { ...c, ownerId: 'other' } : c) },
        { ...state, inventory: state.inventory.map(c => c.id === 'two' ? { ...c, speciesId: 'brachiosaurus' } : c) },
        { ...state, fishingTrips: [{ catch: state.inventory[1], status: 'pending' as const }] },
        M.createListing(state, actor, state.inventory[1], 2, '', at),
    ];
    invalids.forEach((s, i) => {
        const before = JSON.stringify(s);
        expect(() => M.sellFishBatchToAiven(s, actor, ['one', i === 0 ? 'missing' : 'two'], at)).toThrow();
        expect(JSON.stringify(s)).toBe(before);
    });
    expect(() => M.sellFishBatchToAiven(state, actor, ['one', 'one'], at)).toThrow();
});
it('checks combined quota and wallet capacity before removing any fish', () => {
    const state = init(), price = M.catchValue(state, state.inventory[0]);
    for (const s of [
        { ...state, buybackBudgets: { char: { day: sarEconomyDay(at), earned: SAR_DAILY_BUYBACK - price } } },
        { ...state, accounts: { char: SAR_WALLET_LIMIT - price } },
    ]) {
        const before = JSON.stringify(s);
        expect(() => M.sellFishBatchToAiven(s, actor, ['one', 'two'], at)).toThrow();
        expect(JSON.stringify(s)).toBe(before);
    }
});
it('routes a structured board sell plan and refuses malformed batches', () => {
    const plan = parseMarketPlan('<ACTION>sell</ACTION><CATCHES>["one","two"]</CATCHES><NOTE>打算一起卖。</NOTE>')!;
    expect(plan.catchIds).toEqual(['one', 'two']);
    expect(applyMarketPlan(init(), actor, plan).inventory.map(c => c.id)).toEqual(['keep']);
    for (const ids of ['[]', '["one","one"]', '[1]', 'all']) expect(parseMarketPlan(`<ACTION>sell</ACTION><CATCHES>${ids}</CATCHES><NOTE>卖鱼</NOTE>`)).toBeNull();
    expect(buildMarketTurn(actor, init())).toContain('buybackRemaining');
});
