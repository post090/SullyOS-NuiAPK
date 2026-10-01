import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const label = process.env.SAR_RENDER_LABEL || 'after';
const out = `output/sar-gacha-render/${label}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => localStorage.setItem('sar-facility-guide-gacha-v1', 'done'));
await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
const page = await context.newPage(), errors = [], report = { label };
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
try {
    await page.goto(`${process.env.SAR_QA_URL || 'http://127.0.0.1:5173'}/test/fixtures/sar-facilities.html?facility=gacha`);
    await page.waitForFunction(() => document.querySelector('.sarg-draw-button')?.disabled === false);
    await page.evaluate(async () => {
        const { getSARModules } = await import('/utils/vrWorld/sarGacha.ts');
        const { mutateFishingMarket } = await import('/utils/vrWorld/fishingMarket.ts');
        await mutateFishingMarket(market => ({ ...market, sarCommerce: { ...market.sarCommerce,
            gacha: { ...market.sarCommerce.gacha, collection: Object.fromEntries([...getSARModules('variant'), ...getSARModules('story')].map(module => [module.id, 1])) } } }));
    });
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).collectedUnique === 49);
    await shot('idle');
    await page.getByRole('button', { name: /玩法说明/ }).click();
    report.helpAnimations = await page.evaluate(() => document.querySelector('.sarg-root').getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length);
    await page.getByRole('button', { name: '关闭玩法引导' }).click();
    await page.locator('.sarg-draw-button').click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'drawing');
    report.drawing = await state();
    report.animatedFilters = await page.evaluate(() => document.querySelector('.sarg-root').getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getKeyframes().some(frame => frame.filter && frame.filter !== 'none')).length);
    await shot('drawing');
    await page.getByRole('button', { name: '打开扭蛋', exact: true }).click();
    await page.getByRole('button', { name: '收入陈列', exact: true }).waitFor();
    assert.equal((await state()).phase, 'revealed');
    await shot('revealed');
    await page.getByRole('button', { name: '收入陈列', exact: true }).click();
    await page.locator('.sarg-card--compact').first().waitFor();
    report.collectionDOM = await page.locator('.sarg-collection *').count();
    report.mountedCards = await page.locator('.sarg-card--compact').count();
    // Unrelated market events must not repaint the entire archive.
    report.refresh = await page.evaluate(async () => {
        window.gachaCommits = [];
        for (let i = 0; i < 20; i++) {
            window.dispatchEvent(new Event('vr-fishing-market-updated'));
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        return { commits: window.gachaCommits.length, renderMs: window.gachaCommits.reduce((a, b) => a + b, 0) };
    });
    await shot('collection');
    const titles = new Set();
    do {
        for (const title of await page.locator('.sarg-card--compact h3').allTextContents()) titles.add(title);
        const next = page.getByRole('button', { name: '模块下一页', exact: true });
        if (!await next.count() || await next.isDisabled()) break;
        await next.click();
    } while (true);
    assert.equal(titles.size, 25, 'all variants remain reachable');
    await page.locator('.sarg-card--compact').last().click();
    await page.getByRole('button', { name: '关闭模块详情' }).click();
    await page.getByRole('tab', { name: /异界坐标/ }).click();
    assert((await page.locator('.sarg-collection__count').innerText()).includes('24'));
    if (label !== 'before') {
        assert.equal(report.helpAnimations, 0, 'covered machine pauses during help');
        assert.equal(report.animatedFilters, 0, 'draw animation only animates compositor properties');
        assert(report.mountedCards <= 8, 'archive mounts a bounded page');
        assert.equal(report.refresh.commits, 0, 'unchanged snapshots do not commit a render');
    }
    assert.deepEqual(errors, []);
    writeFileSync(`${out}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify(report));
} finally { await browser.close(); }
