import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'output/fishing-qa/npc-lines/discounts';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } });
});
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
const shot = async name => {
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
};
try {
    await page.goto('http://127.0.0.1:5177/test/fixtures/sar-commerce.html?open=shop');
    await page.waitForFunction(() => document.querySelector('.sar-module-card'));
    const offer = await page.evaluate(async () => {
        const m = await import('/utils/vrWorld/fishingMarket.ts');
        const { freshFamiliarity } = await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');
        const { getSARModuleById } = await import('/utils/vrWorld/sarModuleShop.ts');
        const state = await m.mutateFishingMarket(s => ({ ...s, sarFamiliarity: { ...freshFamiliarity(), coupons: [{ id: 'ui-coupon', percent: 10, createdAt: Date.now() - 1 }], discounts: [{ id: 'ui-discount', percent: 20, scope: 'all', expiresAt: Date.now() + 1800000 }] } }));
        const module = getSARModuleById(state.sarCommerce.moduleShop.market.offerIds[0]);
        return { id: module.id, price: module.price, title: module.title };
    });
    await page.waitForFunction(() => document.querySelectorAll('.sar-module-original').length === 5);
    await shot('01-discount-shelf');
    await page.locator('.sar-module-card').first().click();
    await page.getByText('8 折限时优惠', { exact: true }).waitFor();
    assert((await page.locator('.sar-module-buy').innerText()).includes(`${Math.ceil(offer.price * .8)} 鳞币`));
    await shot('02-limited-discount');
    await page.locator('.sar-module-buy').click();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarCommerce.moduleShop.inventory[id] === 1, offer.id);
    assert.equal((await read()).sarFamiliarity.coupons[0].usedBy, undefined);
    await page.evaluate(async () => {
        const m = await import('/utils/vrWorld/fishingMarket.ts');
        await m.mutateFishingMarket(s => ({ ...s, sarFamiliarity: { ...s.sarFamiliarity, discounts: [] } }));
    });
    await page.getByText('9 折优惠券', { exact: true }).waitFor();
    await page.locator('.sar-module-receipt').waitFor({ state: 'hidden' });
    assert((await page.locator('.sar-module-buy').innerText()).includes(`${Math.ceil(offer.price * .9)} 鳞币`));
    await page.setViewportSize({ width: 320, height: 740 });
    await shot('03-coupon-small');
    await page.locator('.sar-module-buy').click();
    await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarFamiliarity.coupons[0].usedBy));
    assert.equal(await page.locator('.sar-module-discount').count(), 0);
    assert.equal((await read()).accounts.user, 100 - Math.ceil(offer.price * .8) - Math.ceil(offer.price * .9));

    // Change persisted price without notifying this page to exercise its stale displayed quote.
    await page.evaluate(async () => {
        const m = await import('/utils/vrWorld/fishingMarket.ts');
        await m.mutateFishingMarket(s => ({ ...s, sarFamiliarity: { ...s.sarFamiliarity, discounts: [{ id: 'expires', percent: 20, scope: 'all', expiresAt: Date.now() + 1800000 }] } }));
    });
    await page.getByText('8 折限时优惠', { exact: true }).waitFor();
    await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('vr_fishing_market_v1'));
        state.sarFamiliarity.discounts[0].expiresAt = Date.now() - 1;
        localStorage.setItem('vr_fishing_market_v1', JSON.stringify(state));
    });
    const before = await read();
    await page.locator('.sar-module-buy').click();
    await page.getByRole('alert').waitFor();
    assert.deepEqual(await read(), before);
    assert((await page.locator('.sar-module-buy').innerText()).includes(`${offer.price} 鳞币`));
    await shot('04-expired-quote');
    assert.deepEqual(errors, []);
    writeFileSync(`${out}/result.json`, JSON.stringify({ errors, offer, checks: ['390px shelf real and original prices', 'limited discount retains coupon', '320px coupon detail', 'coupon actual consumption', 'expiry refuses hidden price increase'] }, null, 2));
    console.log('SAR familiarity discounts UI passed.');
} finally {
    await browser.close();
}
