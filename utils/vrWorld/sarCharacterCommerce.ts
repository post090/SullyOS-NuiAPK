import { ensureActorAccounts, mutateFishingMarket, type FishingMarketState, type MarketActor } from './fishingMarket';
import { getSARModuleById } from './sarModuleShop';
import { sarEconomyDay, SAR_CHARACTER_DAILY_SPEND, SAR_CHARACTER_RESERVE } from './sarEconomy';
import type { SARStorage } from './sarCommerceStorage';
import { rememberSARCollections } from './sarCollectionJournal';

export const characterModuleCount = (state: FishingMarketState, actorId: string, moduleId: string) => {
    const count = state.sarCharacterModules?.[actorId]?.[moduleId] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('角色仓库存档异常，请先备份');
    return count;
};
export const characterModuleAllowance = (state: FishingMarketState, actor: MarketActor, now = Date.now()) => {
    const balance = ensureActorAccounts(state, [actor]).accounts[actor.id];
    const spent = state.ledger.filter(e => e.participants.includes(actor.id) && e.sarPurchase?.kind === 'module' && sarEconomyDay(e.at) >= sarEconomyDay(now))
        .reduce((total, e) => total + e.sarPurchase!.paid, 0);
    return Math.max(0, Math.min(balance - SAR_CHARACTER_RESERVE, SAR_CHARACTER_DAILY_SPEND - spent));
};

/** Autonomous purchases use the actor's money. Failure leaves both their bag and wallet intact. */
export const acquireCharacterModule = async (actor: MarketActor, moduleId: string, requestId: string, storage: SARStorage = localStorage, now = Date.now()) => {
    if (actor.kind !== 'character' || actor.id === 'user' || !requestId || requestId.length > 160) throw new Error('角色购买信息无效');
    return mutateFishingMarket(current => {
        const state = rememberSARCollections(ensureActorAccounts(current, [actor]));
        const old = state.ledger.find(e => e.id === requestId);
        if (old) {
            if (old.sarPurchase?.kind !== 'module' || old.sarPurchase.itemId !== moduleId || old.participants[0] !== actor.id) throw new Error('购买记录不匹配');
            return state;
        }
        // Reuse an owned unit rather than automatically buying duplicates every visit.
        if (characterModuleCount(state, actor.id, moduleId) > 0) return state;
        const module = getSARModuleById(moduleId);
        if (!module) throw new Error('模块不存在');
        if (characterModuleAllowance(state, actor, now) < module.price) throw new Error('角色今天的零用预算不足，先逛逛也可以');
        return { ...state, accounts: { ...state.accounts, [actor.id]: state.accounts[actor.id] - module.price },
            sarCharacterModules: { ...state.sarCharacterModules, [actor.id]: { ...state.sarCharacterModules?.[actor.id], [moduleId]: 1 } },
            ledger: [...state.ledger, { id: requestId, at: now, text: `${actor.name}用自己的 ${module.price} 鳞币买下「${module.title}」，已放进自己的仓库。`, participants: [actor.id], deliveredTo: [],
                sarPurchase: { kind: 'module', itemId: moduleId, paid: module.price } }],
        };
    }, storage);
};

export const consumeCharacterModule = (actorId: string, moduleId: string, storage: SARStorage = localStorage) => mutateFishingMarket(current => {
    const state = rememberSARCollections(current);
    if (actorId === 'user') throw new Error('请从自己的模块袋使用');
    const count = characterModuleCount(state, actorId, moduleId);
    if (!count) throw new Error('角色手里没有这枚模块');
    return { ...state, sarCharacterModules: { ...state.sarCharacterModules, [actorId]: { ...state.sarCharacterModules?.[actorId], [moduleId]: count - 1 } } };
}, storage);
