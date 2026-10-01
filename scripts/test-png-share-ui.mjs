import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const out = 'output/png-share-qa'; mkdirSync(out, { recursive: true });
const base = process.env.PNG_SHARE_QA_URL || 'http://127.0.0.1:5188';
const browser = await chromium.launch({ headless: true, ...(process.env.PNG_SHARE_BROWSER_CHANNEL ? { channel: process.env.PNG_SHARE_BROWSER_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 1080, height: 940 }, acceptDownloads: true });
page.setDefaultTimeout(15000);
const errors = [];
await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, writable: true, value: undefined });
});
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } });
});
const getOutput = () => page.getByLabel('导出结果').textContent();
const open = async () => { await page.getByRole('button', { name: '制作分享卡', exact: true }).click(); await page.getByRole('dialog', { name: '制作分享图片' }).waitFor(); };
const mobileSettings = async (tab = '文字与署名') => {
    const toggle = page.getByRole('button', { name: '调整样式', exact: true });
    if (await toggle.isVisible()) await toggle.click();
    await page.getByRole('button', { name: tab, exact: true }).click();
};
const assertSimultaneousPreview = async () => {
    // A visible locator alone can still be off screen or covered by the drawer.
    await page.waitForFunction(() => {
        const canvas = document.querySelector('.sully-share-preview canvas')?.getBoundingClientRect();
        const panel = document.querySelector('.sully-share-settings')?.getBoundingClientRect();
        const footer = document.querySelector('.sully-share-footer')?.getBoundingClientRect();
        const toggle = document.querySelector('.sully-share-settings-toggle')?.getBoundingClientRect();
        const viewport = window.visualViewport;
        const top = viewport?.offsetTop || 0, bottom = top + (viewport?.height || innerHeight);
        return canvas && panel && footer && toggle && canvas.height >= 60 && panel.height > 50
            && canvas.top >= top && canvas.left >= 0 && canvas.right <= innerWidth
            && canvas.bottom <= toggle.top && toggle.bottom <= panel.top + 1
            && panel.bottom <= footer.top + 1 && footer.bottom <= bottom;
    });
    assert.equal(await page.getByRole('dialog').evaluate(el => el.scrollTop), 0);
};
const download = async (name, target) => {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const file = await promise; await file.saveAs(target);
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    return file;
};
try {
    await page.goto(`${base}/test/fixtures/png-share.html`);
    for (const [label, style] of [['留白相纸', 'paper'], ['全幅海报', 'poster'], ['横版名片', 'business']]) {
        await open();
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.getByLabel('作者名', { exact: true }).fill('Sully 创作室');
        await page.getByLabel('使用限制', { exact: true }).fill('仅限自用 · 禁止商用 · 转载请署名');
        await page.getByLabel('上传分享预览图').setInputFiles('public/room-templates/forest-cottage/preview.png');
        await page.getByRole('button', { name: '更换预览图', exact: true }).waitFor();
        await page.screenshot({ animations: 'disabled', path: `${out}/${style}-desktop.png` });
        const previewPixels = await page.locator('.sully-share-preview canvas').evaluate(canvas => canvas.toDataURL());
        const saved = await download('导出 PNG 分享图', `${out}/${style}.png`);
        assert.equal(saved.suggestedFilename(), '月光来信.sully.png');
        const check = await page.evaluate(async encoded => {
            const { extractShareFromPng } = await import('/utils/pngShare.ts');
            const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
            const { metadata, payload } = extractShareFromPng(bytes, 'character');
            const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            return { metadata, data: JSON.parse(new TextDecoder().decode(payload)), width: bitmap.width, height: bitmap.height, pixels: canvas.toDataURL() };
        }, readFileSync(`${out}/${style}.png`).toString('base64'));
        assert.equal(check.metadata.style, style); assert.equal(check.metadata.author, 'Sully 创作室');
        assert.equal(check.pixels, previewPixels);
        assert.equal(check.data.systemPrompt, '你是月光来信。中文 🌙');
        assert.deepEqual([check.width, check.height], style === 'business' ? [1440, 960] : [1080, 1440]);
    }
    // Small-screen flow, long copy and visible actions without horizontal overflow.
    await page.setViewportSize({ width: 320, height: 740 }); await open();
    assert.equal(await page.getByRole('region', { name: '分享设置', exact: true }).isVisible(), false);
    const expandedPreviewHeight = await page.locator('.sully-share-preview canvas').evaluate(el => el.getBoundingClientRect().height);
    await page.screenshot({ animations: 'disabled', path: `${out}/mobile-320-preview.png` });
    await mobileSettings('图片与排版');
    await page.getByLabel('上传分享预览图').setInputFiles('public/room-templates/forest-cottage/preview.png');
    await page.getByRole('button', { name: '更换预览图', exact: true }).waitFor();
    await assertSimultaneousPreview();
    await page.screenshot({ animations: 'disabled', path: `${out}/mobile-320-layout.png` });
    for (const name of ['横版名片', '全幅海报', '留白相纸']) {
        await page.getByRole('button', { name, exact: true }).click();
        await assertSimultaneousPreview();
    }
    await mobileSettings();
    await page.getByLabel('作品名称', { exact: true }).fill('很长的中文作品名'.repeat(7).slice(0, 60));
    await page.getByLabel('作者名', { exact: true }).fill('作者'.repeat(16));
    await page.getByLabel('使用限制', { exact: true }).fill('仅限自用，转载请注明作者，不得用于商业用途。'.repeat(6).slice(0, 120));
    assert.equal(await page.getByRole('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await assertSimultaneousPreview();
    assert.match(await page.locator('.sully-share-preview canvas').getAttribute('aria-label'), /作者作者/);
    await page.screenshot({ animations: 'disabled', path: `${out}/mobile-320.png` });
    const canvasBeforeScroll = await page.locator('.sully-share-preview canvas').boundingBox();
    await page.locator('.sully-share-fields').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await assertSimultaneousPreview();
    assert.deepEqual(await page.locator('.sully-share-preview canvas').boundingBox(), canvasBeforeScroll);
    // Simulate an iOS keyboard that changes VisualViewport but leaves the layout viewport tall.
    await page.getByLabel('作者名', { exact: true }).focus();
    await page.evaluate(() => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, value: 420 });
        Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 28 });
        visualViewport.dispatchEvent(new Event('resize'));
    });
    await assertSimultaneousPreview();
    await page.screenshot({ animations: 'disabled', path: `${out}/mobile-keyboard.png` });
    await page.evaluate(() => {
        delete visualViewport.height; delete visualViewport.offsetTop;
        visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.getByRole('button', { name: '收起设置', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: '分享设置', exact: true }).isVisible(), false);
    await page.waitForFunction(height => document.querySelector('.sully-share-preview canvas').getBoundingClientRect().height >= height - 1, expandedPreviewHeight);
    await mobileSettings();
    assert.equal(await page.getByLabel('作者名', { exact: true }).inputValue(), '作者'.repeat(16));
    await download('导出 PNG 分享图', `${out}/long-copy.png`);
    // A common phone viewport; sheet dismissal with Escape must keep the editor open.
    await page.setViewportSize({ width: 390, height: 844 }); await open(); await mobileSettings();
    await page.getByLabel('作者名', { exact: true }).fill('Sully 创作室');
    await page.getByLabel('使用限制', { exact: true }).fill('仅限自用 · 禁止商用 · 转载请署名');
    await assertSimultaneousPreview(); await page.screenshot({ animations: 'disabled', path: `${out}/mobile-390-text.png` });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.getByRole('region', { name: '分享设置', exact: true }).isVisible(), false);
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    // Cancel must resolve honestly, download nothing, and allow a fresh editor.
    let downloads = 0; page.on('download', () => downloads++);
    await open(); await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await getOutput(), 'cancelled'); assert.equal(downloads, 0);
    // Original format remains a genuine JSON file.
    await open(); const original = await download('导出原格式', `${out}/original.json`);
    assert.equal(original.suggestedFilename(), '月光.json');
    assert.equal(JSON.parse(readFileSync(`${out}/original.json`, 'utf8')).type, 'sully_character_card');
    // Native/Web Share cancellation leaves the editor ready for retry; no fallback download.
    await page.evaluate(() => { navigator.canShare = () => true; navigator.share = async () => { throw new DOMException('cancel', 'AbortError'); }; });
    await open(); const before = downloads; await page.getByRole('button', { name: '导出 PNG 分享图' }).click();
    await page.waitForFunction(() => document.querySelector('.sully-share-primary')?.textContent === '导出 PNG 分享图');
    assert.equal(downloads, before); assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByRole('button', { name: '关闭分享编辑器' }).click();
    await page.evaluate(() => { navigator.share = undefined; navigator.canShare = undefined; });
    // Real CSS editor export/import, including a wrong-kind rejection before onChange.
    const cssSection = page.getByRole('region', { name: '真实白框编辑器' });
    await cssSection.getByRole('button', { name: '导出分享', exact: true }).click();
    await download('导出 PNG 分享图', `${out}/css.png`);
    const cssInput = cssSection.locator('input[accept*=".css"]');
    await cssInput.setInputFiles(`${out}/css.png`);
    assert.equal(await page.getByLabel('CSS 内容').textContent(), '.chat-chrome { color: #887799; } /* 中文 🌙 */');
    const dialogMessage = page.waitForEvent('dialog'); await cssInput.setInputFiles(`${out}/paper.png`);
    const alert = await dialogMessage; assert.match(alert.message(), /这是一张角色卡分享图/); await alert.accept();
    assert.equal(await page.getByLabel('CSS 内容').textContent(), '.chat-chrome { color: #887799; } /* 中文 🌙 */');
    // Actual role-card importer, fresh browser IndexedDB, no production credentials or storage.
    await page.goto(`${base}/test/fixtures/png-share.html?app=character`);
    const roleInput = page.locator('input[accept=".json,.png,application/json,image/png"]');
    await roleInput.waitFor({ state: 'attached' }); await roleInput.setInputFiles(`${out}/paper.png`);
    await page.waitForFunction(async () => {
        const { DB } = await import('/utils/db.ts');
        const chars = await DB.getAllCharacters(); return chars.some(c => c.name === '月光来信' && c.systemPrompt === '你是月光来信。中文 🌙');
    });
    assert.deepEqual(errors, []);
    writeFileSync(`${out}/result.json`, JSON.stringify({ passed: true, errors, checks: ['three layouts', 'image upload', 'pixel decoding', 'metadata and payload', '320px and 390px simultaneous preview/settings', 'independent settings scroll', 'visual viewport keyboard', 'collapse/expand preserves edits', 'Escape collapses settings first', 'long text', 'cancel and retry', 'original JSON', 'CSS round-trip and wrong kind', 'real character import'] }, null, 2));
    console.log('PNG sharing UI: all checks passed.');
} catch (error) {
    await page.screenshot({ animations: 'disabled', path: `${out}/failure.png` });
    const geometry = await page.evaluate(() => Object.fromEntries(['.sully-share-dialog', '.sully-share-preview canvas', '.sully-share-settings', '.sully-share-fields', '.sully-share-footer', '.sully-share-settings-toggle'].map(selector => [selector, document.querySelector(selector)?.getBoundingClientRect().toJSON()])));
    writeFileSync(`${out}/failure.txt`, `${error}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}\n${JSON.stringify(geometry)}`);
    throw error;
} finally { await browser.close(); }
