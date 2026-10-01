import { describe, expect, it } from 'vitest';
import { buySARModuleWithPayment, ensureSARCommerce, readSARCommerce } from './vrWorld/sarCommerce';
import { acquireCharacterModule } from './vrWorld/sarCharacterCommerce';
import { createFishingMarketState, FISHING_MARKET_STORAGE_KEY, readFishingMarketState } from './vrWorld/fishingMarket';
import { createSARModuleShopState, getSARModuleById, SAR_MODULE_SHOP_STORAGE_KEY } from './vrWorld/sarModuleShop';
import { quoteSARModulePrice, type SARModuleBenefits } from './vrWorld/sarFamiliarity/discounts';
import { freshFamiliarity } from './vrWorld/sarFamiliarity/storageTypes';

const now = new Date(2026, 8, 11, 12);
const at = now.getTime();
const coupon = (id = 'coupon-1', percent = 10) => ({ id, percent, createdAt: at - 1 });
const discount = (id = 'discount-1', percent = 20) => ({ id, percent, scope: 'all' as const, expiresAt: at + 30 * 60_000 });
const memory = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
const seed = async (benefits: SARModuleBenefits, balance = 1000) => {
    const storage = memory();
    storage.setItem(FISHING_MARKET_STORAGE_KEY, JSON.stringify({ ...createFishingMarketState(12), accounts: { user: balance, friend: 500 } }));
    storage.setItem(SAR_MODULE_SHOP_STORAGE_KEY, JSON.stringify(createSARModuleShopState(now, () => .2)));
    await ensureSARCommerce(storage, now);
    const market = readFishingMarketState(storage);
    market.sarFamiliarity = { ...freshFamiliarity(), coupons: [...(benefits.coupons || [])], discounts: [...(benefits.discounts || [])] };
    storage.setItem(FISHING_MARKET_STORAGE_KEY, JSON.stringify(market));
    const module = getSARModuleById(market.sarCommerce!.moduleShop.market.offerIds[0])!;
    return { storage, module, quote: quoteSARModulePrice(module, benefits, at) };
};

describe('SAR 个人线优惠结算', () => {
    it('chooses one cheapest offer, rounds up, and retains coupons when a limited offer is equally good', () => {
        const module = { id: 'module', price: 21 };
        const benefits = { coupons: [coupon('weak', 10), coupon('same', 20)], discounts: [discount()] };
        expect(quoteSARModulePrice(module, benefits, at)).toMatchObject({ originalPrice: 21, price: 17, source: 'limited', percent: 20 });
        expect(quoteSARModulePrice(module, { coupons: [coupon('best', 30)], discounts: [discount()] }, at)).toMatchObject({ price: 15, source: 'coupon', couponId: 'best' });
        expect(quoteSARModulePrice({ ...module, price: 1 }, { coupons: [coupon('keep', 99)] }, at)).toMatchObject({ price: 1, source: 'regular' });
    });
    it('ignores used, future, malformed, expired and other-module benefits', () => {
        expect(quoteSARModulePrice({ id: 'wanted', price: 23 }, {
            coupons: [{ ...coupon('used'), usedBy: 'old-order' }, { ...coupon('future'), createdAt: at + 1 }, coupon('broken', Number.NaN)],
            discounts: [{ ...discount('expired'), expiresAt: at }, { ...discount('other'), scope: 'random-module', moduleId: 'other' }],
        }, at)).toMatchObject({ price: 23, source: 'regular' });
        expect(quoteSARModulePrice({ id: 'wanted', price: 23 }, { discounts: [{ ...discount(), scope: 'random-module', moduleId: 'wanted' }] }, at)).toMatchObject({ price: 19, source: 'limited' });
    });
    it('lets a wallet afford the discounted amount and records the real price in every receipt', async () => {
        const seeded = await seed({ coupons: [coupon()] });
        const state = readFishingMarketState(seeded.storage); state.accounts.user = seeded.quote.price;
        seeded.storage.setItem(FISHING_MARKET_STORAGE_KEY, JSON.stringify(state));
        const result = await buySARModuleWithPayment(seeded.module.id, { storage: seeded.storage, requestId: 'coupon-order', maxCost: seeded.quote.price, now });
        expect(result.balance).toBe(0);
        expect(result.shop.inventory[seeded.module.id]).toBe(1);
        expect(result.shop.purchases.at(-1)?.pricePaid).toBe(seeded.quote.price);
        expect(result.market.ledger.at(-1)?.sarPurchase?.paid).toBe(seeded.quote.price);
        expect(result.market.sarFamiliarity?.coupons[0].usedBy).toBe('coupon-order');
        expect(result.market.accounts.friend).toBe(500);
    });
    it('replaying a successful request never consumes the next coupon or charges twice', async () => {
        const { storage, module, quote } = await seed({ coupons: [coupon('a'), coupon('b')] });
        const options = { storage, requestId: 'repeat', maxCost: quote.price, now };
        await Promise.all([buySARModuleWithPayment(module.id, options), buySARModuleWithPayment(module.id, options)]);
        const result = readSARCommerce(storage, now);
        expect(result.balance).toBe(1000 - quote.price);
        expect(result.shop.inventory[module.id]).toBe(1);
        expect(result.market.sarFamiliarity?.coupons.filter(c => c.usedBy)).toHaveLength(1);
    });
    it('only one concurrent order can spend the last coupon at its displayed price', async () => {
        const { storage, module, quote } = await seed({ coupons: [coupon()] });
        const outcomes = await Promise.allSettled(['one', 'two'].map(requestId => buySARModuleWithPayment(module.id, { storage, requestId, maxCost: quote.price, now })));
        expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(readSARCommerce(storage, now).shop.inventory[module.id]).toBe(1);
        expect(readSARCommerce(storage, now).balance).toBe(1000 - quote.price);
    });
    it('rejects an expired displayed discount without increasing the charge or consuming a fallback coupon', async () => {
        const { storage, module, quote } = await seed({ discounts: [discount()], coupons: [coupon()] });
        const before = storage.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(buySARModuleWithPayment(module.id, { storage, requestId: 'expired', maxCost: quote.price, now: new Date(at + 30 * 60_000) })).rejects.toThrow('价格');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
    });
    it('keeps the coupon when money is insufficient or the atomic storage write fails', async () => {
        const { storage, module, quote } = await seed({ coupons: [coupon()] }, 0);
        const before = storage.getItem(FISHING_MARKET_STORAGE_KEY);
        await expect(buySARModuleWithPayment(module.id, { storage, requestId: 'poor', maxCost: quote.price, now })).rejects.toThrow('不足');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(before);
        const state = readFishingMarketState(storage); state.accounts.user = 100;
        storage.setItem(FISHING_MARKET_STORAGE_KEY, JSON.stringify(state));
        const funded = storage.getItem(FISHING_MARKET_STORAGE_KEY);
        const broken = { getItem: storage.getItem, setItem: () => { throw new Error('quota'); } };
        await expect(buySARModuleWithPayment(module.id, { storage: broken, requestId: 'storage-fail', maxCost: quote.price, now })).rejects.toThrow('quota');
        expect(storage.getItem(FISHING_MARKET_STORAGE_KEY)).toBe(funded);
        await buySARModuleWithPayment(module.id, { storage, requestId: 'retry', maxCost: quote.price, now });
        expect(readSARCommerce(storage, now).market.sarFamiliarity?.coupons[0].usedBy).toBe('retry');
    });
    it('applies a limited discount without consuming coupons or multiplying discounts', async () => {
        const { storage, module, quote } = await seed({ coupons: [coupon('same', 20)], discounts: [discount('first'), discount('second')] });
        const result = await buySARModuleWithPayment(module.id, { storage, requestId: 'limited', maxCost: quote.price, now });
        expect(result.balance).toBe(1000 - Math.ceil(module.price * .8));
        expect(result.market.sarFamiliarity?.coupons[0].usedBy).toBeUndefined();
        expect(result.market.sarFamiliarity?.discounts).toHaveLength(2);
    });
    it('does not apply user coupons or discounts to a character wallet', async () => {
        const { storage, module } = await seed({ coupons: [coupon()], discounts: [discount()] });
        const result = await acquireCharacterModule({ id: 'friend', name: '朋友', kind: 'character' }, module.id, 'character-buy', storage, at);
        expect(result.accounts.friend).toBe(500 - module.price);
        expect(result.accounts.user).toBe(1000);
        expect(result.sarFamiliarity?.coupons[0].usedBy).toBeUndefined();
        expect(result.ledger.at(-1)?.sarPurchase?.paid).toBe(module.price);
        await expect(buySARModuleWithPayment(module.id, { storage, requestId: 'character-buy', maxCost: module.price, now })).rejects.toThrow('不匹配');
    });
});
