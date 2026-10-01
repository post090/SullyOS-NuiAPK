import { FISHING_MARKET_STORAGE_KEY } from './fishingMarket';

export type SARStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const SAR_GACHA_KEY = 'vr_sar_gacha_state_v1';
export const SAR_SHOP_KEY = 'vr_sar_module_shop_v1';

/** After migration, inventory and its payment live in the same atomic storage value. */
export const readSARCommerceValue = (key: string, storage: Pick<Storage, 'getItem'>): string | null => {
    const raw = storage.getItem(FISHING_MARKET_STORAGE_KEY);
    if (raw) {
        let market;
        try { market = JSON.parse(raw); } catch { throw new Error('鳞币存档无法读取，没有覆盖原存档'); }
        const field = key === SAR_GACHA_KEY ? 'gacha' : 'moduleShop';
        if (market?.sarCommerce && Object.prototype.hasOwnProperty.call(market.sarCommerce, field)) {
            const value = market.sarCommerce[field];
            if (!value || typeof value !== 'object') throw new Error('模块存档无法读取，没有覆盖原存档');
            return JSON.stringify(value);
        }
    }
    return storage.getItem(key);
};
