import type { FishingMarketState } from './fishingMarket';

export type SARCollectionJournal = { version: 1; actors: Record<string, { chips: string[]; modules: string[] }> };

/** Preserve evidenced ownership before the last legacy item is consumed. No invented grants or dates. */
export const rememberSARCollections = <T extends FishingMarketState>(state: T): T => {
    const owners = new Map<string, { chips: Set<string>; modules: Set<string> }>();
    const record = (actorId: string, kind: 'chips' | 'modules', id: string) => {
        if (!actorId || !id) return;
        const entry = owners.get(actorId) || { chips: new Set<string>(), modules: new Set<string>() };
        entry[kind].add(id); owners.set(actorId, entry);
    };
    for (const [actorId, entry] of Object.entries(state.sarCollection?.actors || {})) {
        entry.chips.forEach(id => record(actorId, 'chips', id));
        entry.modules.forEach(id => record(actorId, 'modules', id));
    }
    const commerce = state.sarCommerce;
    for (const [id, count] of Object.entries(commerce?.gacha.collection || {})) if (count > 0) record('user', 'chips', id);
    commerce?.gacha.history.forEach(entry => record('user', 'chips', entry.moduleId));
    for (const [id, count] of Object.entries(commerce?.moduleShop.inventory || {})) if (count > 0) record('user', 'modules', id);
    commerce?.moduleShop.purchases.forEach(entry => record('user', 'modules', entry.moduleId));
    for (const [actorId, bag] of Object.entries(state.sarCharacterModules || {})) {
        for (const [id, count] of Object.entries(bag)) if (count > 0) record(actorId, 'modules', id);
    }
    for (const receipt of state.ledger) {
        if (receipt.sarPurchase && receipt.participants[0]) record(receipt.participants[0], receipt.sarPurchase.kind === 'draw' ? 'chips' : 'modules', receipt.sarPurchase.itemId);
    }
    if (!owners.size && !state.sarCollection) return state;
    return { ...state, sarCollection: { version: 1, actors: Object.fromEntries([...owners].map(([id, entry]) => [id, { chips: [...entry.chips], modules: [...entry.modules] }])) } };
};
