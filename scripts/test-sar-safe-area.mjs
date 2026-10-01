import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const out = 'output/sar-safe-area';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5177/test/fixtures/sar-facilities.html?facility=modules&guide=off');
  await page.waitForFunction(() => !!window.facilityQA);
  await page.evaluate(async () => {
    const m = await import('/utils/vrWorld/fishingMarket.ts');
    const f = await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');
    await m.mutateFishingMarket(state => ({ ...state, sarFamiliarity: { ...f.freshFamiliarity(), souvenirs: [{ id:'qa-safe-keepsake', title:'安全区纪念物', description:'回忆', npc:'caian', sceneId:'qa', nodeId:'qa', at:1, userName:'测试用户', flags:{}, draft:{} }] } }));
  });
  const views = { modules: '.sar-module-shop__header', garden: '.clay-header', warehouse: '.sar-hub-header', settings: '.sar-hub-header', cabinet: '.sarc-header', gacha: '.sarg-header', board: '.board-header', inspector: '.sar-object-inspector-panel > header' };
  for (const [name, width, height, top] of [['portrait',390,844,83], ['landscape',844,390,24], ['small',320,568,44], ['no-inset',390,844,0]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(top => {
      // Simulate the iOS standalone fallback when env(safe-area-inset-top) is zero.
      const style = document.documentElement.style;
      style.setProperty('--standalone-safe-area-top', `${top}px`);
      style.setProperty('--safe-top', 'max(env(safe-area-inset-top, 0px), var(--standalone-safe-area-top, 0px))');
      style.setProperty('--chrome-top', 'var(--safe-top)');
      style.setProperty('--safe-bottom', '34px');
    }, top);
    for (const [view, headerSelector] of Object.entries(views)) {
      await page.evaluate(view => window.facilityQA.setView(view), view);
      const header = page.locator(headerSelector);
      await header.waitFor();
      const button = header.locator('button').first();
      const box = await button.boundingBox();
      assert(box && box.y >= top - 1 && box.y + box.height <= height, `${name}/${view}: back button outside safe area: ${JSON.stringify(box)}`);
      if (view === 'modules') {
        const main = await page.locator('.sar-module-shop__body').boundingBox();
        const head = await header.boundingBox();
        assert(main.y >= head.y + head.height - 1, 'Module content overlaps its header');
      }
      if (view === 'inspector') {
        const panel = await page.locator('.sar-object-inspector-panel').boundingBox();
        assert(panel.y + panel.height <= height - 34 + 1, `${name}: tall inspector exceeds safe area`);
      }
      if (view === 'warehouse') {
        await page.getByRole('button', {name:'纪念',exact:true}).click();
        await page.getByRole('button', {name:/^安全区纪念物 ·/}).click();
        const close = page.getByRole('button', {name:'收好纪念物',exact:true});
        const k = await close.boundingBox();
        assert(k.y >= top && k.y + k.height <= height, `${name}: keepsake back button outside safe area`);
        await close.click();
      }
      if (['modules', 'garden'].includes(view)) {
        await page.screenshot({ path: `${out}/${name}-${view}.png` });
        await header.locator('.sar-facility-help').click();
        const guide = page.locator('.sar-facility-guide');
        await guide.waitFor();
        const g = await guide.boundingBox();
        assert(g.y >= top && g.y + g.height <= height - 34 + 1, `${name}/${view}: guide outside safe area`);
        await page.getByRole('button', { name: '关闭玩法引导', exact: true }).click();
      }
      if (view === 'garden') {
        await page.locator('.clay-theme').click();
        const sheet = page.locator('.clay-sheet');
        await sheet.waitFor();
        const s = await sheet.boundingBox();
        assert(s.y >= top - 1, `${name}: garden sheet overlaps safe area`);
        await sheet.getByRole('button', { name: '关闭面板', exact: true }).click();
      }
      await button.click();
      await page.getByText('设施已关闭', { exact: true }).waitFor();
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS 32 facility layouts plus keepsakes: safe back buttons, usable exits, module content, tall inspectors, guide dialogs and garden sheets across portrait/landscape/small/no-inset.');
} finally { await browser.close(); }
