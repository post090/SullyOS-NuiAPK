import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/sar-collection-names'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await context.addInitScript(() => {
    for (const facility of ['water', 'warehouse', 'garden']) localStorage.setItem(`sar-facility-guide-${facility}-v1`, 'done');
    localStorage.setItem('sar-garden-guide-v1', 'done');
});
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
const button = name => page.getByRole('button', { name, exact: true });
const enter = name => page.evaluate(name => window.facilityQA.setView(name), name);
const rename = async name => {
    await page.evaluate(name => window.facilityQA.os.updateUserProfile({ name }), name);
    await page.waitForFunction(name => window.facilityQA.os.userProfile.name === name, name);
};
const shot = name => page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
try {
    await page.goto(`${process.env.SAR_QA_URL || 'http://127.0.0.1:5173'}/test/fixtures/sar-facilities.html?facility=water`);
    await page.waitForFunction(() => window.facilityQA?.os.characters.length >= 60);
    await rename('雨眠');
    await page.evaluate(async () => {
        const market = await import('/utils/vrWorld/fishingMarket.ts');
        await market.mutateFishingMarket(state => {
            for (const [id, speciesId, ownerId] of [['qa-old-fish', 'glass-minnow', 'user'], ['qa-old-dino', 'brachiosaurus', 'user'], ['qa-char-fish', 'glass-minnow', 'qa-facility-0']]) {
                state = market.addCatchToState(state, { id, speciesId, ownerId, ownerName: ownerId === 'user' ? 'user' : '旧名字', caughtAt: Date.now(), weather: 'clear', weatherLabel: '晴天', weatherSource: 'simulated', sizeCm: 12, quality: 2, origin: { kind: 'fished', actorId: ownerId, actorName: ownerId === 'user' ? 'user' : '旧名字', at: Date.now() } });
            }
            return state;
        });
    });
    await button('图鉴').click();
    await page.getByRole('heading', { name: '雨眠 的水域图鉴' }).waitFor();
    await page.getByRole('button', { name: /玻璃米鱼/ }).click();
    const fish = page.getByRole('dialog', { name: '玻璃米鱼', exact: true });
    await fish.getByText(/^雨眠 的收藏/).waitFor();
    assert(!/user/i.test(await fish.innerText()));
    await rename('小雨');
    await fish.getByText(/^小雨 的收藏/).waitFor();
    await shot('fish-detail');
    await button('关闭详情').click();
    await page.getByLabel('查看谁的钱包和收藏', { exact: true }).selectOption('qa-facility-0');
    await page.getByRole('button', { name: /玻璃米鱼/ }).click();
    await fish.getByText(/^Sully 的收藏/).waitFor();
    await button('关闭详情').click();
    await enter('warehouse');
    await button('打开收集图鉴').click();
    await page.getByRole('button', { name: /^鱼类图鉴 ·/ }).click();
    assert.equal(await page.getByLabel('图鉴主人', { exact: true }).locator('option[value="user"]').innerText(), '小雨');
    await shot('fish-catalog');
    await rename('雨眠');
    await page.waitForFunction(() => document.querySelector('select[aria-label="图鉴主人"] option[value="user"]').textContent === '雨眠');
    await enter('garden');
    await button('恐龙').click();
    await page.locator('.clay-collection button').first().click();
    await button('名字与管理').click();
    await button('近看与来历').click();
    const dino = page.getByRole('dialog', { name: '恐龙图鉴详情', exact: true });
    await dino.getByText('雨眠', { exact: true }).waitFor();
    await dino.getByText(/雨眠钓到了它/).waitFor();
    assert(!/user/i.test(await dino.innerText()));
    await shot('dinosaur-detail');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vr_fishing_market_v1')).inventory.find(c => c.id === 'qa-old-fish'));
    assert.equal(stored.ownerId, 'user'); assert.equal(stored.ownerName, 'user');
    assert.deepEqual(errors, []);
    writeFileSync(`${out}/report.json`, JSON.stringify({ legacyCatchNames: true, liveProfileRename: true, characterNames: true, fishCatalog: true, dinosaurOwnerAndOrigin: true, storedOwnershipUnchanged: true, errors }, null, 2));
    console.log('Collection names passed: old catches, profile renames, character names, fish catalog and dinosaur details.');
} finally { await browser.close(); }
