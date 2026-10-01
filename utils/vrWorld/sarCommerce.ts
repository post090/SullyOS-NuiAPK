import { ensureActorAccounts, marketId, mutateFishingMarket, readFishingMarketState, type FishingMarketState } from './fishingMarket';
import { drawSARModule, getSARModuleById as getDrawModule, isSARFreeDrawAvailable, readSARGachaState, SAR_GACHA_STORAGE_KEY, type SARModulePool } from './sarGacha';
import { consumeSARModule, getSARModuleById, readSARModuleShopState, rollSARModuleOffers, SAR_MODULE_SHOP_STORAGE_KEY } from './sarModuleShop';
import type { SARStorage } from './sarCommerceStorage';
import { rememberSARCollections } from './sarCollectionJournal';
import { quoteSARModulePrice } from './sarFamiliarity/discounts';

export const SAR_EXTRA_DRAW_PRICE = 90;
const user = { id: 'user', name: '我', kind: 'user' as const };
export const newSARPurchaseId = () => marketId('sar_purchase');

// Old keys remain untouched as a migration source. Scratch writes never reach the user's store.
const scratchStorage = (market: FishingMarketState, storage: SARStorage): SARStorage => {
    if (market.sarCommerce && (!market.sarCommerce.gacha || !market.sarCommerce.moduleShop)) throw new Error('模块存档不完整，请先备份；本次没有扣款');
    const values = new Map<string, string>();
    for (const [key, field] of [[SAR_GACHA_STORAGE_KEY, 'gacha'], [SAR_MODULE_SHOP_STORAGE_KEY, 'moduleShop']] as const) {
        const embedded = market.sarCommerce?.[field];
        const raw = embedded ? JSON.stringify(embedded) : storage.getItem(key);
        if (raw) {
            try { const parsed=JSON.parse(raw);if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); }
            catch { throw new Error('模块存档无法读取，请先备份；本次没有扣款'); }
            values.set(key, raw);
        }
    }
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
};

const prepare = (market: FishingMarketState, storage: SARStorage, now: Date) => {
    const scratch = scratchStorage(market, storage);
    return rememberSARCollections({ ...ensureActorAccounts(market, [user]), sarCommerce: {
        gacha: readSARGachaState(scratch), moduleShop: readSARModuleShopState(scratch, now),
    } });
};
const snapshot = (market: FishingMarketState) => ({ market, gacha: market.sarCommerce!.gacha, shop: market.sarCommerce!.moduleShop, balance: market.accounts.user });

export const readSARCommerce = (storage: SARStorage = localStorage, now = new Date()) => snapshot(prepare(readFishingMarketState(storage), storage, now));
export const ensureSARCommerce = async (storage: SARStorage = localStorage, now = new Date()) =>
    snapshot(await mutateFishingMarket(market => prepare(market, storage, now), storage));

const validateQuote = (cost: number, maxCost: number, balance: number) => {
    if (!Number.isSafeInteger(maxCost) || maxCost < 0 || cost > maxCost) throw new Error('价格或免费次数已变化，请确认页面上的金额后再试');
    if (balance < cost) throw new Error(`鳞币不足，还差 ${cost - balance} 鳞币`);
};
type PaymentOptions = { requestId: string; maxCost: number; storage?: SARStorage; now?: Date; random?: () => number };
const previousReceipt = (market: FishingMarketState, requestId: string) => {
    if (!requestId || requestId.length > 160) throw new Error('购买记录编号无效');
    return market.ledger.find(entry => entry.id === requestId);
};

/** One locked write commits the charge, inventory, daily entitlement and receipt together. */
export const drawSARModuleWithPayment = async (pool: SARModulePool, options: PaymentOptions) => {
    if (pool !== 'story' && pool !== 'variant') throw new Error('卡池不存在');
    const storage = options.storage || localStorage;
    const now = options.now || new Date();
    const market = await mutateFishingMarket(current => {
        const next = prepare(current, storage, now);
        const prior = previousReceipt(next, options.requestId);
        if (prior) {
            if (prior.sarPurchase?.kind !== 'draw' || getDrawModule(prior.sarPurchase.itemId)?.pool !== pool) throw new Error('购买记录不匹配');
            return next;
        }
        const cost = isSARFreeDrawAvailable(pool, next.sarCommerce.gacha, now) ? 0 : SAR_EXTRA_DRAW_PRICE;
        validateQuote(cost, options.maxCost, next.accounts.user);
        const scratch = scratchStorage(next, storage);
        const drawn = drawSARModule(pool, scratch, now, options.random || Math.random, cost > 0);
        if (!drawn.ok) throw new Error('免费次数已变化，请刷新后再试');
        return { ...next, accounts: { ...next.accounts, user: next.accounts.user - cost },
            sarCommerce: { ...next.sarCommerce, gacha: drawn.state },
            ledger: [...next.ledger, { id: options.requestId, at: now.getTime(), text: `我${cost ? `支付 ${cost} 鳞币` : '使用今日免费机会'}抽到「${drawn.module.title}」。`, participants: ['user'], deliveredTo: [],
                sarPurchase: { kind: 'draw', itemId: drawn.module.id, paid: cost, firstCopy: drawn.firstCopy } }],
        };
    }, storage);
    const receipt = market.ledger.find(entry => entry.id === options.requestId)!.sarPurchase!;
    return { ...snapshot(market), module: getDrawModule(receipt.itemId)!, firstCopy: !!receipt.firstCopy, paid: receipt.paid };
};

export const buySARModuleWithPayment = async (moduleId: string, options: PaymentOptions) => {
    const storage = options.storage || localStorage;
    const market = await mutateFishingMarket(current => {
        const now = options.now || new Date();
        const next = prepare(current, storage, now);
        const prior = previousReceipt(next, options.requestId);
        if (prior) {
            if (prior.sarPurchase?.kind !== 'module' || prior.sarPurchase.itemId !== moduleId || prior.participants[0] !== 'user') throw new Error('购买记录不匹配');
            return next;
        }
        const module = getSARModuleById(moduleId);
        if (!module) throw new Error('模块不存在');
        if (!next.sarCommerce.moduleShop.market.offerIds.includes(moduleId)) throw new Error('货架已经更新，请重新选择模块');
        const quote = quoteSARModulePrice(module, next.sarFamiliarity, now.getTime());
        validateQuote(quote.price, options.maxCost, next.accounts.user);
        if ((next.sarCommerce.moduleShop.inventory[moduleId] || 0) >= Number.MAX_SAFE_INTEGER) throw new Error('模块数量已达存储上限');
        const shop = next.sarCommerce.moduleShop;
        return { ...next, accounts: { ...next.accounts, user: next.accounts.user - quote.price },
            sarCommerce: { ...next.sarCommerce, moduleShop: { ...shop,
                inventory: { ...shop.inventory, [moduleId]: (shop.inventory[moduleId] || 0) + 1 },
                purchases: [...shop.purchases, { id: options.requestId, moduleId, purchasedAt: now.getTime(), pricePaid: quote.price }],
            } },
            ...(quote.couponId && next.sarFamiliarity ? { sarFamiliarity: { ...next.sarFamiliarity,
                coupons: next.sarFamiliarity.coupons.map(coupon => coupon.id === quote.couponId ? { ...coupon, usedBy: options.requestId } : coupon),
            } } : {}),
            ledger: [...next.ledger, { id: options.requestId, at: now.getTime(), text: `我支付 ${quote.price} 鳞币，买下「${module.title}」${quote.source === 'regular' ? '' : `（${quote.label}）`}。`, participants: ['user'], deliveredTo: [],
                sarPurchase: { kind: 'module', itemId: module.id, paid: quote.price } }],
        };
    }, storage);
    return snapshot(market);
};

export const refreshSARModuleShelf = async (storage: SARStorage = localStorage, now = new Date()) => snapshot(await mutateFishingMarket(current => {
    const next = prepare(current, storage, now);
    return { ...next, sarCommerce: { ...next.sarCommerce, moduleShop: rollSARModuleOffers(next.sarCommerce.moduleShop, Math.random, null) } };
}, storage));

export const consumeOwnedSARModule = async (moduleId: string, storage: SARStorage = localStorage) => snapshot(await mutateFishingMarket(current => {
    const next = prepare(current, storage, new Date());
    const consumed = consumeSARModule(next.sarCommerce.moduleShop, moduleId, null);
    if (!consumed.ok) throw new Error('这枚模块已不在袋中，请重新选择');
    return { ...next, sarCommerce: { ...next.sarCommerce, moduleShop: consumed.state } };
}, storage));
