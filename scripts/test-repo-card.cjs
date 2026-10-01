const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<body></body>');
    await page.addScriptTag({ path: path.resolve('worker/beauty-share/admin/repo-card.js') });
    const images = await page.evaluate(() => {
      const item = { metadata: { name: 'SULLY · 星光桌面', credit: '示例创作者' }, share_code: 'S-DEMO', signature: '一位使用者', message: '很喜欢这套桌面的颜色。\n\n尤其是小小的星球图标，每次打开手机都会多看一眼。谢谢你认真画下这些可爱的细节！' };
      const sample = renderRepoCards([item]);
      const long = renderRepoCards(Array.from({length:3}, () => ({ ...item, message: '一段很长的反馈，需要完整保留而不是缩小文字。'.repeat(55) })));
      if (long.length < 2 || long.some(c => c.height > 2160)) throw Error('Pagination failed');
      return [...sample, long[1]].map(canvas => canvas.toDataURL('image/png'));
    });
    assert.equal(images.length, 2);
    fs.mkdirSync('output/repo-card', { recursive: true });
    images.forEach((image, i) => fs.writeFileSync(`output/repo-card/${i ? 'long' : 'sample'}.png`, Buffer.from(image.split(',')[1], 'base64')));
    console.log('Single feedback and long multi-page feedback rendered.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
