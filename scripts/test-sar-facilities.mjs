import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/sar-facilities'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], modelCalls = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => {
    const url = new URL(route.request().url()); if (url.pathname.includes('/chat/completions')) modelCalls.push(url.pathname);
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } });
});
const btn = name => page.getByRole('button', { name, exact: true });
const shot = name => page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const market = () => page.evaluate(() => JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
const enter = async facility => { await page.evaluate(facility => window.facilityQA.setView(facility), facility); };
const guide = async (facility, name) => {
    const panel = page.locator(`[data-sar-guide="${facility}"]`); await panel.waitFor();
    assert((await panel.innerText()).includes(name)); await shot(`${facility}-guide`);
    await btn('关闭玩法引导').click(); assert.equal(await panel.count(), 0);
};
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
try {
    await page.goto(`${process.env.SAR_QA_URL || 'http://127.0.0.1:5173'}/test/fixtures/sar-facilities.html`);
    await page.waitForFunction(() => window.facilityQA?.os.characters.filter(char => char.id.startsWith('qa-facility-')).length === 60);
    await guide('cabinet', '凯恩');
    assert.equal(await page.locator('.sar-character-picker-grid button').count(), 8);
    assert.equal(await page.locator('.sarc-library-book').count(), 6);
    assert.deepEqual(await page.evaluate(() => window.cabinetReads), []);
    await shot('cabinet-60-characters');
    await btn('史册下一页').click(); await btn('史册下一页').click(); assert.equal(await page.locator('.sarc-library-book').count(), 5);
    await btn('选择角色 角色 01').click(); assert((await page.locator('.sarc-library-owner').innerText()).includes('角色 01'));
    assert.equal(await page.locator('.sarc-library-book').count(), 0, 'empty characters remain selectable');
    await page.getByLabel('角色分组', { exact: true }).selectOption('qa-b');
    assert.equal(await page.locator('.sar-character-picker-grid button').count(), 8);
    await btn('角色下一页').click(); await btn('选择角色 角色 38').click();
    assert((await page.locator('.sarc-library-owner').innerText()).includes('角色 38'));
    await page.getByLabel('搜索角色', { exact: true }).fill('59'); assert.equal(await page.locator('.sar-character-picker-grid button').count(), 1);
    await btn('选择角色 角色 59').click(); await page.getByRole('tab', { name: '角色的随笔', exact: true }).click();
    await page.waitForFunction(() => window.cabinetReads.length === 1); assert.deepEqual(await page.evaluate(() => window.cabinetReads), ['qa-facility-59']);
    await page.evaluate(() => { window.failCabinetRead = true; window.dispatchEvent(new Event('vr-session-done')); });
    await page.getByRole('alert').waitFor(); assert.equal(await page.getByText('还没留下随笔', { exact: true }).count(), 0);
    await shot('cabinet-read-retry'); await btn('重新读取随笔').click();
    await page.getByText('还没留下随笔', { exact: true }).waitFor(); assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.cabinetReads), ['qa-facility-59', 'qa-facility-59', 'qa-facility-59']);
    await page.locator('.sarc-header__records').click(); assert((await page.locator('.sar-character-picker-grid button').count()) <= 8);
    await btn('选择角色 角色 59').waitFor();
    await page.getByLabel('角色分组', { exact: true }).selectOption('qa-b'); await page.getByLabel('搜索角色', { exact: true }).fill('47');
    await btn('选择角色 角色 47').click(); await shot('forge-grouped-character');
    await enter('warehouse'); await guide('warehouse', '凯恩');
    assert.equal(await page.locator('.sar-hub-items>.sar-hub-item').count(), 12);
    assert.equal(await page.getByLabel('仓库主人', { exact: true }).locator('option[value="user"]').innerText(), '我');
    const first = await page.locator('.sar-hub-item').first().getAttribute('aria-label');
    await btn('仓库物品下一页').click(); assert.notEqual(await page.locator('.sar-hub-item').first().getAttribute('aria-label'), first);
    await shot('warehouse-paged');
    await page.setViewportSize({ width: 320, height: 640 }); await noOverflow(); await shot('warehouse-320');
    await page.getByLabel('仓库主人', { exact: true }).selectOption('qa-facility-59');
    assert.equal(await page.getByRole('navigation', { name: '仓库物品分页' }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await enter('gacha'); await guide('gacha', '凯恩');
    await page.getByRole('button', { name: /两枚芯片，一段异世界 · 玩法说明/ }).click();
    assert((await page.locator('[data-sar-guide]').innerText()).includes('异界坐标'));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-sar-guide]').count(), 0);
    assert.equal(await page.locator('.sarg-root').count(), 1); await shot('gacha-help-entry');
    await enter('water'); await guide('water', '艾文'); await btn('简单').click();
    await page.evaluate(() => { Math.random = () => .1; window.advanceTime(0); });
    const before = (await market()).inventory.length;
    const idle = await state(), canvas = page.locator('.fishing-water canvas'), box = await canvas.boundingBox();
    await shot('simple-fish-shadow');
    await canvas.click({ position: { x: idle.shadow.x * box.width, y: idle.shadow.y * box.height } });
    assert.equal((await state()).phase, 'waiting'); assert.equal((await market()).inventory.length, before);
    await page.evaluate(() => window.advanceTime(1400)); await shot('simple-bobber');
    await page.evaluate(() => window.advanceTime(2100)); assert.equal((await state()).phase, 'hooked'); await shot('simple-reel');
    await page.evaluate(() => window.advanceTime(1000)); await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'caught' && !JSON.parse(window.render_game_to_text()).saving);
    assert.equal((await market()).inventory.length, before + 1); await shot('simple-caught');
    await page.evaluate(() => { Math.random = () => .99; }); await btn('再钓一次').click(); await page.evaluate(() => window.advanceTime(4400));
    assert.equal((await state()).phase, 'escaped'); assert.equal((await market()).inventory.length, before + 1); await shot('simple-empty');
    await enter('board'); await guide('board', '凯恩'); await shot('board-help-entry');
    await enter('modules'); await guide('modules', '凯恩'); await shot('modules-help-entry');
    await enter('garden'); await guide('garden', '艾文'); await shot('garden-help-entry');
    await enter('cabinet'); assert.equal(await page.locator('[data-sar-guide]').count(), 0, 'seen guide does not interrupt every visit');
    await page.setViewportSize({ width: 320, height: 640 }); await shot('cabinet-320'); await noOverflow();
    assert.equal(await page.locator('.sar-character-picker-grid button').count(), 8);
    // Daily-only visit: authored topics remain untouched while each greeting sentence changes expression.
    await page.evaluate(async () => {
        const { mutateFishingMarket } = await import('/utils/vrWorld/fishingMarket.ts');
        const { freshFamiliarity } = await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');
        const { familiarityDay } = await import('/utils/vrWorld/sarFamiliarity/state.ts');
        await mutateFishingMarket(state => { const next = structuredClone(state); next.sarFamiliarity = freshFamiliarity();
            for (const npc of ['caian','aiven']) next.sarFamiliarity.npcs[npc].day = familiarityDay(); return next; });
    });
    for (const npc of ['caian','aiven']) {
        await enter(npc); await page.locator('.srf-bubble').waitFor();
        const faces = [];
        while (await page.locator('.srf-bubble').count()) {
            faces.push(await page.locator('.sar-npc-portrait').getAttribute('data-expression'));
            await page.locator('.srf-bubble').click();
        }
        assert(faces.length >= 3 && new Set(faces).size >= 2, npc + ' daily greeting varies expressions');
    }
    const prefs = await page.evaluate(async () => (await import('/utils/vrWorld/sarBackup.ts')).collectSARLocalBackup().preferences);
    for (const id of ['water', 'board', 'garden', 'gacha', 'cabinet', 'modules', 'warehouse']) assert.equal(prefs[`sar-facility-guide-${id}-v1`], 'done');
    assert.deepEqual(errors, []); assert.deepEqual(modelCalls, []);
    writeFileSync(`${out}/report.json`, JSON.stringify({ characters: 60, visibleCharacters: 8, visibleRecords: 6, visibleWarehouseItems: 12, guideCount: 7, lazyNoteReads: true, animatedFishing: true, emptyFishing: true, errors, modelCalls }, null, 2));
    console.log('SAR facilities passed: grouped/paged 60 characters, lazy notes, warehouse pages, seven guides, animated simple fishing and empty outcomes.');
} catch (error) { await shot('failure'); console.error((await page.locator('body').innerText()).slice(-2000)); throw error; }
finally { await browser.close(); }
