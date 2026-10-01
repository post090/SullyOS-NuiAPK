import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const out = 'output/chat-input-style';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const styles = () => page.evaluate(() => ['.sully-chat-composer', '.sully-chat-input-wrap', 'textarea', '.sully-chat-send-button'].map(selector => {
    const node = document.querySelector(selector), css = getComputedStyle(node), rect = node.getBoundingClientRect();
    return { background: css.backgroundColor, color: css.color, radius: css.borderRadius, font: css.fontFamily, size: css.fontSize, padding: css.padding, width: rect.width, height: rect.height };
}));
try {
    await page.goto(`${process.env.SAR_QA_URL || 'http://127.0.0.1:5177'}/test/fixtures/chat-input-style.html`);
    await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    const input = page.locator('textarea'), suggestions = page.getByRole('region', { name: '表情包联想' });
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const custom of [true, false]) {
            await page.getByRole('checkbox').setChecked(custom);
            await input.fill('你好');
            await input.focus();
            const before = await styles();
            if (custom) assert.equal(before[0].background, 'rgb(240, 237, 230)', 'legacy beautification is applied');
            await input.fill('亲亲');
            await suggestions.waitFor();
            assert.deepEqual(await styles(), before, 'suggestions do not change composer appearance or size');
            assert.equal(await input.evaluate(el => el === document.activeElement), true);
            await page.screenshot({ path: `${out}/${custom ? 'custom' : 'default'}-${width}.png` });
            const regionBox = await suggestions.boundingBox(), composerBox = await page.locator('.sully-chat-inputbar').boundingBox();
            assert(regionBox.y + regionBox.height <= composerBox.y + 1, 'suggestions stay above the input');
            await page.getByRole('button', { name: '发送表情：亲亲', exact: true }).click();
            assert.equal(await input.inputValue(), '亲亲');
            await suggestions.waitFor({ state: 'hidden' });
            assert.deepEqual(await styles(), before);
            await input.fill('亲亲你');
            await suggestions.waitFor();
            await page.getByRole('button', { name: '收起表情联想' }).click();
            await input.focus();
            assert.deepEqual(await styles(), before);
            await page.getByRole('button', { name: '倒计时', exact: true }).click();
            await input.focus();
            assert.deepEqual(await styles(), before, 'countdown also preserves legacy selectors');
            await page.getByRole('button', { name: '取消自动回复' }).click();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
    }
    assert.equal(JSON.parse(await page.getByTestId('sent').textContent()).length, 4, 'one send per sticker click');
    assert.deepEqual(errors, []);
    console.log('PASS: community/default composer styles unchanged at 390/320px; suggestion send, draft, focus, dismiss and countdown.');
} finally { await browser.close(); }
