import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SAR_QA_URL || 'http://127.0.0.1:5189';
const out = 'output/sar-feedback'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
await page.addInitScript(() => localStorage.setItem('sar-facility-guide-cabinet-v1', 'done'));
// This fixture references an optional Tailwind artifact; the tested reader uses its own CSS.
await page.route('**/output/fishing-qa/tailwind.cdn.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
let calls = 0;
await page.route('**/sar-qa-api/chat/completions', route => {
    calls++;
    return route.fulfill({ json: { choices: [{ message: { content: '{"worldNarration":"雨停了。", "character":"恢复第一行\n恢复第二行",}' } }] } });
});
try {
    await page.goto(`${base}/test/fixtures/sar-simulation.html`);
    await page.locator('.sarc-library-book').click();
    const outside = await page.locator('details.sarc-card-fold').allTextContents();
    await button('继续故事').click();
    await button('第 1 幕我的消息操作').click(); await button('修改').click();
    await page.getByLabel('修改我的消息', { exact: true }).fill('修改后的原话\n保留换行');
    await button('保存修改').click();
    await page.getByText('修改已保存', { exact: true }).waitFor();
    await page.reload();
    await page.locator('.sarc-library-book').click(); await button('继续故事').click();
    await page.getByText('修改后的原话\n保留换行', { exact: true }).waitFor();
    await button('演绎资料与设置').click();
    assert.deepEqual(await page.locator('details.sarc-card-fold').allTextContents(), outside);
    await page.locator('details.sarc-card-fold summary').first().click();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({ path: `${out}/details-320.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert(!(await page.locator('body').innerText()).includes('HIDDEN_QA'));
    await button('返回故事').click();
    await page.getByLabel('你说的话或动作').fill('我们在窗前坐一会儿。');
    await button('发送').click();
    await page.getByText('恢复第一行\n恢复第二行', { exact: true }).waitFor();
    assert.equal(calls, 1);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('vr_sar_simulations_v1')));
    assert.equal(state.runs[0].interactionsUsed, 3);
    assert.equal(state.runs[0].maxInteractions, 50);
    await button('返回身份卡').click(); await button('删除这张档案').click();
    assert(await page.getByRole('alertdialog').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'confirmation stays inside the viewport after scrolling');
    await page.screenshot({ path: `${out}/delete-320.png` });
    await button('取消').click(); assert(await button('继续故事').isEnabled());
    await button('删除这张档案').click(); await button('确认删除档案').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('vr_sar_simulations_v1')).cards.length === 0);
    const remaining = await page.evaluate(async () => {
        const { loadSARSimulationMessages } = await import('/utils/vrWorld/sarSimulation.ts');
        return loadSARSimulationMessages('sar-reader-run');
    });
    assert.equal(remaining.length, 0);
    await page.reload(); assert.equal(await page.locator('.sarc-library-book').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: user edit/reload, matching dossiers, hidden facts, 320px layout, repaired model response, unchanged 50 turns, cancel/delete/reload and thread cleanup');
} finally { await browser.close(); }
