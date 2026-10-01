import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = 'output/sar-event-preview';
mkdirSync(out, { recursive: true });

// Exercise the actual compiled DEV gate, including production's constant replacement.
const compileGate = async dev => {
    const bundle = await build({
        entryPoints: ['utils/vrWorld/sarFamiliarity/devPreview.ts'], bundle: true,
        write: false, format: 'esm', platform: 'node', treeShaking: true,
        define: { 'import.meta.env.DEV': String(dev) },
    });
    return (await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)).canPreviewFamiliarityEvent;
};
const productionGate = await compileGate(false);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], modelCalls = [], results = [];
await context.addInitScript(() => ['gacha', 'water', 'garden', 'warehouse', 'shop', 'board', 'cabinet'].forEach(id => localStorage.setItem('sar-facility-guide-' + id + '-v1', 'done')));
await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/chat/completions')) modelCalls.push(url.pathname);
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } });
});
page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
const view = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const savedMarket = () => page.evaluate(() => localStorage.getItem('vr_fishing_market_v1'));
const waitForScene = id => page.waitForFunction(id => {
    const state = JSON.parse(window.render_game_to_text());
    return state.mode === 'sar-familiarity' && state.scene === id && !state.busy;
}, id);

async function completeEvent(scene) {
    let steps = 0;
    // One complete authored route includes membership and photo interactions.
    while (await page.locator('.srf-dialog').count()) {
        assert(++steps < 600, `${scene.id}: preview must terminate`);
        const state = await view();
        if(state.finished){assert.equal(await page.locator('.srf-collected').textContent(),`结束${scene.rank}星事件：${scene.title}`);await page.screenshot({path:`${out}/${scene.id}-ending.png`,animations:'disabled'});}
        assert.equal(state.error, '', `${scene.id}: scene error`);
        if (await page.locator('.sar-dialogue-choices__list button').count()) await page.locator('.sar-dialogue-choices__list button').first().click();
        else if (await button('就用这个形象').count()) await button('就用这个形象').click();
        else if (await button('拍好了').count()) await button('拍好了').click();
        else if (await button('按下神秘按钮').count()) await button('按下神秘按钮').click();
        else await button('继续对话').click();
        await page.waitForFunction(() => !document.querySelector('.srf-dialog') || !JSON.parse(window.render_game_to_text()).busy);
    }
    return steps;
}

try {
    await page.goto((process.env.SAR_QA_URL || 'http://127.0.0.1:5177') + '/test/fixtures/kanata.html?npcs=show');
    await button('SAR').waitFor();
    const scenes = await page.evaluate(async () => {
        const market = await import('/utils/vrWorld/fishingMarket.ts');
        const catalog = await import('/utils/vrWorld/sarFamiliarity/catalog.ts');
        localStorage.setItem('vr_sar_club_state_v1', JSON.stringify({ version: 1, updateSeenVersion: 1, npcPreference: 'show', caianMet: true }));
        market.saveFishingMarketState(market.createFishingMarketState(17));
        return catalog.FAMILIARITY_SCENES.map(scene => ({ npc: scene.npc, id: scene.id, title: scene.title, kind: scene.kind, rank: scene.rank }));
    });
    assert.equal(scenes.length, 84);
    assert.equal(new Set(scenes.map(scene => scene.id)).size, 84);
    assert.equal(scenes.filter(scene => scene.kind === 'event').length, 6);
    for (const scene of scenes) {

        assert.equal(productionGate(scene), false, `production must not expose ${scene.id}`);
    }
    for (const invalid of [undefined, null, {}, { id: 'missing', npc: 'caian', kind: 'event' }, { id: 'C4-SPECIAL', npc: 'caian', kind: 'event', rank: 4 }, { ...scenes[0], npc: 'unknown' }]) {

        assert.equal(productionGate(invalid), false, 'production always rejects temporary preview');
    }

    await page.reload();
    await button('SAR').click();
    await button('打开仓库').click();
    await button('打开收集图鉴').click();
    await button('名册').click();
    const saved = await savedMarket();
    await page.getByRole('button', { name: /^回忆/ }).click();
    assert.equal(await page.locator('.sar-roster-memory:enabled').count(),0,'default locks restored');
    await button('打开调试面板').click();
    await page.getByRole('switch',{name:'SAR 剧情与表情校对'}).click();
    await button('关闭调试面板').click();
    await page.waitForFunction(()=>document.querySelectorAll('.sar-roster-memory:enabled').length>0);

    for (const npc of ['caian', 'aiven']) {
        const npcScenes = scenes.filter(scene => scene.npc === npc);
        await page.locator('.sar-roster-person-tabs button').filter({ hasText: npc === 'caian' ? '凯恩' : '艾文' }).click();
        await page.getByRole('button', { name: /^回忆/ }).click();
        assert.equal(await page.locator('.sar-roster-memory:enabled').count(), npcScenes.length);
        assert.equal(await page.locator('.sar-roster-memory:disabled').count(), 0);
        assert.equal(await page.locator('.sar-roster-topic-group .sar-roster-memory:enabled').count(), 30);
        const groups = page.locator('.sar-roster-topic-group');
        for (let index = 0; index < await groups.count(); index++) {
            const group = groups.nth(index);
            if (!await group.evaluate(element => element.open)) await group.locator('summary').click();
        }
        await page.screenshot({ path: `${out}/${npc}-roster.png`, animations: 'disabled' });

        for (const scene of npcScenes) {
            await page.locator(`.sar-roster-memory[data-scene-id="${scene.id}"]`).click();
            await waitForScene(scene.id);
            const opened = await view();
            assert.equal(opened.preview, true, `${scene.id}: unfinished content uses preview`);
            assert.equal(opened.replay, true, `${scene.id}: preview uses read-only replay path`);
            assert.equal(opened.error, '');
            let steps = 0;
            if (scene.kind === 'event') {
                await page.screenshot({ path: `${out}/${scene.id}.png`, animations: 'disabled' });
                steps = await completeEvent(scene);
                console.log(`${scene.id} complete: ${steps} steps, no save changes`);
            } else await button('离开对话').click();
            await page.locator('.sar-familiarity-roster').waitFor();
            assert.equal(await savedMarket(), saved, `${scene.id}: preview must not change progress, rewards, discounts, drafts or delivery queues`);
            results.push({ id: scene.id, npc, kind: scene.kind, accessible: true, ...(steps ? { completedRoute: true, steps } : {}) });
        }
        const progress = await page.evaluate(npc => JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarFamiliarity?.npcs[npc] || { stars: 0, completed: {} }, npc);
        assert.equal(progress.stars, 0, 'temporary availability must not light stars');
        assert.deepEqual(progress.completed, {}, 'temporary availability must not collect memories');
        assert.equal(await page.getByRole('img', { name: '熟悉度 0 / 5 星', exact: true }).count(), 1);
    }
    await button('打开调试面板').click();
    await page.getByRole('switch',{name:'SAR 剧情与表情校对'}).click();
    await button('关闭调试面板').click();
    await page.waitForFunction(()=>document.querySelectorAll('.sar-roster-memory:enabled').length===0);
    assert.equal(await savedMarket(),saved,'closing review never rewrites progress');
    assert.equal(results.length, 84);
    assert.equal(results.filter(result => result.completedRoute).length, 6);
    assert.deepEqual(errors, []);
    assert.deepEqual(modelCalls, []);
    writeFileSync(out + '/report.json', JSON.stringify({ results, errors, modelCalls, readOnly: true, productionGuard: { allScenesRejected: scenes.length, invalidInputsRejected: 6 } }, null, 2));
    console.log('All 84 temporary previews accessible; six star events fully read; production gate and save isolation passed.');
} catch (error) {
    writeFileSync(out + '/failure.json', JSON.stringify({ message: error.message, errors, modelCalls, results }, null, 2));
    throw error;
} finally {
    await page.screenshot({ path: `${out}/last.png`, animations: 'disabled' }).catch(() => {});
    await browser.close();
}
