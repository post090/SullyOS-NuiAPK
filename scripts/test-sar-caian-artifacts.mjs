import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/sar-caian-artifacts'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
const base = process.env.SAR_QA_URL || 'http://127.0.0.1:5173';
try {
    await page.goto(`${base}/test/fixtures/sar-facilities.html?facility=warehouse&guide=off`);
    await page.waitForFunction(() => window.facilityQA);
    await page.evaluate(async () => { const { DB } = await import('/utils/db.ts'); await DB.saveUserProfile({ ...await DB.getUserProfile(), name: '小雨' }); });
    const cases = await page.evaluate(async () => {
        const { FAMILIARITY_SCENES } = await import('/utils/vrWorld/sarFamiliarity/catalog.ts');
        return ['admin-card', 'membership-card', 'meeting-record', 'photo-studio', 'memory-card'].map(kind => {
            const scene = FAMILIARITY_SCENES.find(s => s.npc === 'caian' && Object.values(s.nodes).some(n => n.effect?.kind === kind));
            return { kind, scene: scene.id, node: Object.entries(scene.nodes).find(([, n]) => n.effect?.kind === kind)[0], line: Object.values(scene.nodes).find(n => n.effect?.kind === kind).effectLine || 0 };
        });
    });
    for (const item of cases) {
        await page.goto(`${base}/test/fixtures/sar-dialogue.html?scene=${item.scene}&node=${item.node}&line=${item.line}`);
        await page.waitForFunction(() => document.documentElement.dataset.qaPositioned === 'true');
        const effect = page.locator(`.srf-fx-${item.kind}`).first(); await effect.waitFor();
        if (item.kind === 'admin-card') await effect.locator('.sar-npc-portrait img:not([aria-hidden])').waitFor();
        await page.screenshot({ path: `${out}/${item.kind}-390.png`, animations: 'disabled' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (item.kind === 'membership-card') {
            await page.getByRole('button', { name: '就用这个形象', exact: true }).click();
            await page.getByRole('button', { name: '形象已确认', exact: true }).waitFor();
        }
        if (item.kind === 'photo-studio') {
            const controls = effect.locator('.srf-fx-photo-controls');
            await controls.locator('summary').click();
            await page.getByLabel('选择要调整的人物或背景').waitFor();
            await page.getByLabel('选择要调整的人物或背景').selectOption('background');
            await page.getByLabel('背景大小').fill('1.15');
            await controls.locator('summary').click();
            assert.equal(await controls.getAttribute('open'), null);
            await page.getByRole('button', { name: '拍好了', exact: true }).click();
            await page.getByRole('button', { name: '看看背面', exact: true }).click();
            await page.getByText('写在照片背面', { exact: true }).waitFor();
            await page.screenshot({ path: `${out}/photo-back-390.png`, animations: 'disabled' });
            await page.getByRole('button', { name: '看看照片', exact: true }).click();
        }
        await page.setViewportSize({ width: 320, height: 640 });
        await page.screenshot({ path: `${out}/${item.kind}-320.png`, animations: 'disabled' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.setViewportSize({ width: 390, height: 844 });
    }
    // A prop is tied to the actual reveal, and the portrait never remounts for it.
    await page.goto(`${base}/test/fixtures/sar-dialogue.html?scene=C3-SPECIAL&node=spare-card`);
    await page.waitForFunction(() => document.documentElement.dataset.qaPositioned === 'true');
    assert.equal(await page.locator('.srf-prop').count(), 0, 'searching for the card is not its reveal');
    await page.evaluate(() => window.qaCast = document.querySelector('.sar-dialogue-cast'));
    await page.getByRole('button', { name: '继续对话', exact: true }).click();
    await page.locator('.srf-prop-memory-card').waitFor();
    assert.equal(await page.evaluate(() => window.qaCast === document.querySelector('.sar-dialogue-cast')), true);
    await page.getByRole('button', { name: '继续对话', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).line === 2 && !JSON.parse(window.render_game_to_text()).busy);
    assert.equal(await page.locator('.srf-prop').count(), 0, 'put the prop away when dialogue continues');
    await page.evaluate(() => window.dispatchEvent(new Event('vr-fishing-market-updated')));
    assert.equal(await page.locator('.srf-prop').count(), 0, 'save refresh must not re-show it');
    await page.goto(`${base}/test/fixtures/sar-dialogue.html?scene=A1-SPECIAL&node=show&line=1`);
    await page.waitForFunction(() => document.documentElement.dataset.qaPositioned === 'true');
    await page.locator('.srf-prop').waitFor();
    assert.equal(await page.locator('.sar-dialogue-choices__list').count(), 0, 'choices wait until the prop is put away');
    await page.getByRole('button', { name: '继续对话', exact: true }).click();
    await page.locator('.sar-dialogue-choices__list').waitFor();
    assert.equal(await page.locator('.srf-prop').count(), 0);
    assert.deepEqual(errors, []);
    writeFileSync(`${out}/report.json`, JSON.stringify({ cases, mobileWidths: [320, 390], memberConfirmation: true, photoFlip: true, errors }, null, 2));
    console.log('Caian artifacts passed: five live scene effects, membership confirmation, photo flip, 320/390 layouts.');
} finally { await browser.close(); }
