const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://127.0.0.1:5188/');
    await page.evaluate(async (data) => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const Preview = (await import('/components/share/BeautyPresetPreview.tsx')).default;
      const { DB } = await import('/utils/db.ts');
      DB.getRecentMessagesWithCount = () => { throw Error('Preview must not read messages'); };
      const host = document.createElement('div');
      host.id = 'desktop-preview-test';
      host.style.cssText = 'position:fixed;inset:0;background:white;z-index:999999;padding:12px;overflow:auto';
      document.body.append(host);
      createRoot(host).render(React.createElement(Preview, { data }));
    }, JSON.parse(fs.readFileSync('presets/appearance/sully.json', 'utf8')));
    const host = page.locator('#desktop-preview-test');
    await host.getByLabel('预览桌面页').waitFor({ timeout: 60000 });
    const pages = await host.getByLabel('预览桌面页').locator('option').count();
    assert(pages >= 4);
    await host.getByText('System Online', { exact: true }).waitFor();
    assert.equal(await host.locator('.launcher-page').first().isVisible(), true);
    fs.mkdirSync('output/desktop-preview', { recursive: true });
    for (let i = 0; i < pages; i++) {
      await host.getByLabel('预览桌面页').selectOption(String(i));
      await page.waitForTimeout(400);
      const visible = await host.locator('.launcher-pages > div').evaluateAll(nodes => nodes.filter(n => getComputedStyle(n).display !== 'none').length);
      assert.equal(visible, 1);
      await host.screenshot({ path: `output/desktop-preview/page-${i + 1}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.getByLabel('预览桌面页').selectOption('0');
    await page.waitForTimeout(400);
    await host.screenshot({ path: 'output/desktop-preview/desktop.png' });
    console.log(`Desktop preview: ${pages} pages; mobile/desktop screenshots; no message reads.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
