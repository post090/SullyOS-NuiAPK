export interface SARModuleCoupon {
    id: string;
    percent: number;
    createdAt: number;
    usedBy?: string;
}
export interface SARModuleDiscount {
    id: string;
    percent: number;
    scope: 'all' | 'random-module';
    moduleId?: string;
    expiresAt: number;
}
export interface SARModuleBenefits {
    coupons?: readonly SARModuleCoupon[];
    discounts?: readonly SARModuleDiscount[];
}
export interface SARModulePriceQuote {
    originalPrice: number;
    price: number;
    percent: number;
    source: 'regular' | 'coupon' | 'limited';
    label: string;
    couponId?: string;
    discountId?: string;
    expiresAt?: number;
}

const validPercent = (value: number) => Number.isInteger(value) && value > 0 && value <= 100;
const discountedPrice = (price: number, percent: number) => Math.max(1, Math.ceil(price * (100 - percent) / 100));
const foldLabel = (percent: number) => `${Number(((100 - percent) / 10).toFixed(1))} 折`;

/** User benefits only; character purchases deliberately never call this helper. */
export function quoteSARModulePrice(module: { id: string; price: number }, benefits?: SARModuleBenefits, now = Date.now()): SARModulePriceQuote {
    if (!Number.isSafeInteger(module.price) || module.price < 1) throw new Error('模块价格无效');
    const base: SARModulePriceQuote = { originalPrice: module.price, price: module.price, percent: 0, source: 'regular', label: '原价' };
    const candidates: SARModulePriceQuote[] = [];
    for (const discount of benefits?.discounts || []) {
        if (!discount.id || !validPercent(discount.percent) || !Number.isFinite(discount.expiresAt) || discount.expiresAt <= now) continue;
        if (discount.scope !== 'all' && !(discount.scope === 'random-module' && discount.moduleId === module.id)) continue;
        candidates.push({ ...base, price: discountedPrice(module.price, discount.percent), percent: discount.percent, source: 'limited', label: `${foldLabel(discount.percent)}限时优惠`, discountId: discount.id, expiresAt: discount.expiresAt });
    }
    for (const coupon of benefits?.coupons || []) {
        if (!coupon.id || coupon.usedBy !== undefined || !validPercent(coupon.percent) || !Number.isFinite(coupon.createdAt) || coupon.createdAt > now) continue;
        candidates.push({ ...base, price: discountedPrice(module.price, coupon.percent), percent: coupon.percent, source: 'coupon', label: `${foldLabel(coupon.percent)}优惠券`, couponId: coupon.id });
    }
    // A coupon that saves no coins is kept. Equal payable amounts prefer the temporary discount.
    return candidates.filter(quote => quote.price < base.price).sort((left, right) =>
        left.price - right.price ||
        Number(left.source === 'coupon') - Number(right.source === 'coupon') ||
        (left.expiresAt ?? Infinity) - (right.expiresAt ?? Infinity) ||
        right.percent - left.percent ||
        (left.discountId || left.couponId || '').localeCompare(right.discountId || right.couponId || ''),
    )[0] || base;
}
