import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/sar-module-presentation'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], modelCalls = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/chat/completions')) modelCalls.push(url.pathname);
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } });
});
const url = `${process.env.SAR_QA_URL || 'http://127.0.0.1:5173'}/test/fixtures/sar-module-presentation.html`;
const shot = name => page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
const ready = () => page.waitForFunction(() => window.moduleQA?.os.characters.some(char => char.id === 'qa-sar-presentation'));
const waitText = text => page.waitForFunction(text => document.querySelector('[data-sar-gal-text]')?.textContent.trim() === text, text);
const switchMode = async name => { await page.getByRole('button', { name: '打开见面菜单', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
const snapshot = () => page.evaluate(async () => {
    const { DB } = await import('/utils/db.ts');
    return { characters: (await DB.getAllCharacters()).filter(char => char.id.startsWith('qa-sar-presentation')).map(char => ({ id: char.id, module: char.vrState?.sarModule })),
        user: (await DB.getUserProfile()).vrState?.sarModule, messages: await DB.getRecentMessagesByCharId('qa-sar-presentation', 50) };
});
try {
    await page.goto(url); await page.waitForFunction(() => window.moduleQA?.os.characters.length > 0);
    await page.evaluate(async () => {
        const { DB } = await import('/utils/db.ts');
        const { SAR_MODULE_CATALOG } = await import('/utils/vrWorld/sarModuleShop.ts');
        const { installSARModuleOnCharacter, installSARModuleOnUser, createSARModuleSurfaceMeta } = await import('/utils/vrWorld/sarModuleRuntime.ts');
        const os = window.moduleQA.os;
        const runtime = installSARModuleOnCharacter(SAR_MODULE_CATALOG[0], 1);
        const char = { ...os.characters[0], id: 'qa-sar-presentation', name: '凯恩', voiceEnabled: false,
            sprites: { normal: '/assets/sar/caian-chibi.png' }, dateBackground: '', dateLightReading: true,
            vrState: { enabled: false, intervalMinutes: 120, sarModule: runtime } };
        await DB.saveCharacter(char);
        await DB.saveCharacter({ ...char, id: 'qa-sar-presentation-second', name: '艾文', vrState: { ...char.vrState, sarModule: installSARModuleOnCharacter(SAR_MODULE_CATALOG[1], 2) } });
        const userRuntime = installSARModuleOnUser(SAR_MODULE_CATALOG[2], char, 3);
        await DB.saveUserProfile({ ...os.userProfile, name: '测试用户', vrState: { enabled: false, sarModule: userRuntime } });
        await DB.saveMessage({ charId: char.id, role: 'user', type: 'text', content: '“早上好。”', timestamp: 4,
            metadata: { source: 'date', sarModuleSurface: createSARModuleSurfaceMeta(userRuntime, '“早安，凡人。”') } });
        await DB.saveMessage({ charId: char.id, role: 'assistant', type: 'text', content: '“你好。”\n“再见。”\n“是的。”', timestamp: 5,
            metadata: { source: 'date', sarModuleSurface: createSARModuleSurfaceMeta(runtime, '“哼。”\n“哼。”\n“才不是。”') } });
    });
    await page.reload(); await ready();
    const monitor = page.getByRole('region', { name: '当前模块', exact: true });
    await monitor.getByRole('button', { name: '提前结束凯恩的模块', exact: true }).waitFor();
    assert.equal(await monitor.locator('li').count(), 3);
    assert((await monitor.innerText()).includes('剩 5 轮'));
    await waitText('“哼。”'); await shot('gal-surface-monitor-390');
    await page.getByRole('button', { name: '收起模块悬浮窗', exact: true }).click();
    // Repeated surface line: the second original sentence, not the first.
    await page.getByRole('button', { name: '查看原台词', exact: true }).click(); await waitText('“再见。”');
    await shot('gal-truth-390');
    const saved = await snapshot();
    await switchMode('阅读模式');
    assert.equal(await page.getByRole('button', { name: '查看原台词', exact: true }).count(), 2);
    assert((await page.locator('body').innerText()).includes('早安，凡人。'));
    const readingToggles = page.getByRole('button', { name: '查看原台词', exact: true });
    await readingToggles.last().click();
    assert((await page.locator('body').innerText()).includes('再见。'));
    await readingToggles.first().click();
    assert((await page.locator('body').innerText()).includes('早上好。'));
    await shot('reading-truth-390');
    // Modes own their state. GAL remains original, then change it without touching reading.
    await switchMode('立绘模式'); await waitText('“再见。”');
    await page.getByRole('button', { name: '显示污染台词', exact: true }).click(); await waitText('“哼。”');
    await switchMode('阅读模式'); assert.equal(await page.getByRole('button', { name: '显示污染台词', exact: true }).count(), 2);
    assert.deepEqual((await snapshot()).messages, saved.messages, 'display toggles never change stored messages');
    await switchMode('立绘模式');
    await page.getByRole('button', { name: '展开模块悬浮窗', exact: true }).click();
    await monitor.getByRole('button', { name: '提前结束凯恩的模块', exact: true }).click();
    await page.waitForFunction(() => window.moduleQA.os.characters.find(char => char.id === 'qa-sar-presentation').vrState.sarModule.phase === 'afterglow');
    await monitor.getByRole('button', { name: '提前结束测试用户（我）的模块', exact: true }).click();
    await page.waitForFunction(() => window.moduleQA.os.userProfile.vrState.sarModule.phase === 'afterglow');
    const promptResult = await page.evaluate(async () => {
        const { buildSARModulePrompt, advanceSARModuleAfterReply } = await import('/utils/vrWorld/sarModuleRuntime.ts');
        const os = window.moduleQA.os, char = os.characters.find(char => char.id === 'qa-sar-presentation');
        const current = char.vrState.sarModule;
        const requested = { ...current, phase: 'active', remainingTurns: 10, afterglowTurns: 0 };
        os.updateCharacter(char.id, previous => ({ vrState: { ...previous.vrState, sarModule: advanceSARModuleAfterReply(previous.vrState.sarModule, requested) } }));
        return ['chat', 'date'].map(mode => buildSARModulePrompt(char, os.userProfile, mode));
    });
    assert(promptResult.every(prompt => prompt.includes('被用户提前结束') && prompt.includes('必须恢复平常表达')));
    await shot('ended-390');
    // Navigate away while the global panel and counts remain.
    await page.evaluate(() => window.moduleQA.setShowDate(false));
    assert.equal(await monitor.locator('li').count(), 1);
    // Dragging the header never toggles it, including at viewport edges.
    const header = page.getByRole('button', { name: '收起模块悬浮窗', exact: true });
    const bounds = await header.boundingBox();
    await page.mouse.move(bounds.x + 50, bounds.y + 20); await page.mouse.down(); await page.mouse.move(2, 120, { steps: 8 }); await page.mouse.up();
    assert.equal(await header.getAttribute('aria-expanded'), 'true');
    await page.setViewportSize({ width: 320, height: 568 });
    await shot('monitor-320');
    const panelBounds = await monitor.boundingBox();
    assert(panelBounds.x >= 0 && panelBounds.x + panelBounds.width <= 320 && panelBounds.y + panelBounds.height <= 568);
    await page.goto(`${url}?legacy`); await ready(); await waitText('“哼。”');
    await page.getByRole('button', { name: '收起模块悬浮窗', exact: true }).click();
    await page.getByRole('button', { name: '查看原台词', exact: true }).click(); await waitText('“再见。”');
    await shot('legacy-resume-truth-320');
    const reloaded = await snapshot();
    assert.equal(reloaded.characters.find(char => char.id === 'qa-sar-presentation').module.afterglowTurns, 3);
    assert.equal(reloaded.user.afterglowTurns, 3);
    assert.equal(reloaded.characters.find(char => char.id.endsWith('-second')).module.remainingTurns, 10);
    assert.deepEqual(reloaded.messages, saved.messages);
    await page.getByRole('button', { name: '展开模块悬浮窗', exact: true }).click();
    await monitor.getByRole('button', { name: '提前结束艾文的模块', exact: true }).click();
    await monitor.waitFor({ state: 'hidden' });
    const ended = await snapshot();
    assert(ended.characters.every(char => char.module.phase === 'afterglow' && char.module.afterglowTurns === 3));
    await page.reload(); await ready(); assert.equal(await monitor.count(), 0);
    await page.evaluate(async () => {
        const { installSARModuleOnCharacter } = await import('/utils/vrWorld/sarModuleRuntime.ts');
        const { SAR_MODULE_CATALOG } = await import('/utils/vrWorld/sarModuleShop.ts');
        const os = window.moduleQA.os, char = os.characters.find(char => char.id.endsWith('-second'));
        os.updateCharacter(char.id, previous => ({ vrState: { ...previous.vrState, sarModule: installSARModuleOnCharacter(SAR_MODULE_CATALOG[0]) } }));
    });
    await monitor.waitFor(); assert.equal(await monitor.locator('li').count(), 1);
    await shot('reinstalled-monitor');
    assert.deepEqual(errors, []); assert.deepEqual(modelCalls, []);
    writeFileSync(`${out}/report.json`, JSON.stringify({ targets: 3, independentModes: true, originalResume: true, persistedEarlyEnd: true, inFlightGuard: true, errors, modelCalls }, null, 2));
    console.log('SAR presentation passed: both Date modes and targets, repeat-line mapping, legacy resume, draggable monitor, early end and persistence.');
} catch (error) { await shot('failure'); console.error((await page.locator('body').innerText()).slice(-1800)); throw error; }
finally { await browser.close(); }
