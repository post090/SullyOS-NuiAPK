const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
        await page.goto(`${process.env.CAMERA_QA_URL || 'http://127.0.0.1:5188'}/test/fixtures/chat-camera.html`);
        const stats = await page.evaluate(async () => {
            const { lightCameraSticker, trimCameraSticker } = await import('/utils/cameraLighting.ts');
            const { applyCameraPhotoEffects, DEFAULT_CAMERA_EFFECTS } = await import('/utils/cameraPhotoEffects.ts');
            const image = new Image(); image.src = '/assets/sar/caian-chibi.png'; await image.decode();
            const raw = document.createElement('canvas'); raw.width = image.width; raw.height = image.height; raw.getContext('2d').drawImage(image, 0, 0);
            const source = trimCameraSticker(raw);
            const sheet = document.createElement('canvas'); sheet.width = 900; sheet.height = 1080; sheet.id = 'lighting-comparison';
            const ctx = sheet.getContext('2d'); ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, 900, 1080); ctx.font = '18px sans-serif';
            let maxMs = 0;
            for (const [row, [label, dark, light]] of [['日光', '#607c76', '#e8eee6'], ['暖光', '#6a4342', '#f1c891'], ['暗光', '#101b36', '#39547b']].entries()) {
                const photo = document.createElement('canvas'); photo.width = 420; photo.height = 300;
                const p = photo.getContext('2d'); const gradient = p.createLinearGradient(0, 0, 420, 200); gradient.addColorStop(0, light); gradient.addColorStop(1, dark); p.fillStyle = gradient; p.fillRect(0, 0, 420, 300);
                const started = performance.now();
                const lit = lightCameraSticker(source, photo, { x: 0.55, y: 0.55, width: .45, height: .8, angle: 0, strength: .85, rim: .4, aspect: 1.4 });
                maxMs = Math.max(maxMs, performance.now() - started);
                for (let column = 0; column < 2; column++) {
                    const x = 15 + column * 450, y = row * 360 + 44;
                    ctx.fillStyle = '#293c34'; ctx.fillText(`${label} · ${column ? '溶图后' : '原贴纸'}`, x, y - 14);
                    ctx.drawImage(photo, x, y); const h = 240, w = h * source.width / source.height;
                    ctx.drawImage(column ? lit : source, x + 231 - w / 2, y + 165 - h / 2, w, h);
                }
            }
            const dark = document.createElement('canvas'); dark.width = dark.height = 32;
            const d = dark.getContext('2d'); d.fillStyle = '#111'; d.fillRect(0, 0, 32, 32);
            const before = dark.toDataURL(); applyCameraPhotoEffects(dark, { ...DEFAULT_CAMERA_EFFECTS, bloom: 1 });
            const unchanged = before === dark.toDataURL();
            document.body.replaceChildren(sheet); return { maxMs, darkBloomUnchanged: unchanged };
        });
        assert.equal(stats.darkBloomUnchanged, true);
        await page.locator('#lighting-comparison').screenshot({ path: 'output/chat-camera/lighting-comparison.png' });
        console.log('Lighting visual QA:', stats);
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
