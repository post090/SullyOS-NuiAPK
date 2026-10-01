// Run with pnpm exec node --loader ./test/fixtures/playwright-loader.mjs scripts/test-sar-expression-review.mjs.
// This creates a fresh browser context, blocks external calls and never visits the user's browser profile.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const out = 'output/fishing-qa/sar-expression-review';
const baseURL = process.env.SAR_QA_URL || 'http://127.0.0.1:5177';
const marketKey = 'vr_fishing_market_v1';
const privateName = 'QA_PRIVATE_小雨_不可导出';
const privatePrompt = 'QA_PRIVATE_CHARACTER_PROMPT_DO_NOT_EXPORT';
const expressions = {
    caian: ['normal', 'happy', 'curious', 'embarrassed', 'serious', 'shy', 'aboutaster', 'Enduring Pain', 'avoidant', 'normal2', 'warm'],
    aiven: ['normal', 'happy', 'interested', 'sad', 'shy', 'sleeping'],
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true });
const page = await context.newPage();
const pageErrors = [], consoleErrors = [], failedRequests = [], screenshotNames = [];
let canonicalBefore;
mkdirSync(out, { recursive: true });
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue()
    : route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
await context.addInitScript(() => {
    for (const id of ['gacha', 'water', 'garden', 'warehouse', 'shop', 'board', 'cabinet']) localStorage.setItem(`sar-facility-guide-${id}-v1`, 'done');
    // Verify the clipboard payload without replacing the real desktop clipboard.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.__sarReviewClipboard = String(text); },
        readText: async () => window.__sarReviewClipboard || '',
    } });
});

const button = name => page.getByRole('button', { name, exact: true });
const review = () => page.locator('.sar-expression-review');
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const rawMarket = () => page.evaluate(key => localStorage.getItem(key), marketKey);
const unchanged = async label => assert.equal(await rawMarket(), canonicalBefore, `Canonical market JSON changed during ${label}`);
const editedValue = (npc, before, avoid = []) => expressions[npc].find(value => value !== before && !avoid.includes(value));

async function waitDialogue(id) {
    await page.locator('.srf-dialog').waitFor();
    await page.waitForFunction(id => {
        if (typeof window.render_game_to_text !== 'function') return false;
        const current = JSON.parse(window.render_game_to_text());
        return current.mode === 'sar-familiarity' && current.scene === id && !current.busy;
    }, id);
}

async function selectNpc(npc) {
    await page.locator('.sar-roster-person-tabs button').nth(npc === 'caian' ? 0 : 1).click();
    await page.waitForFunction(npc => {
        const tab = document.querySelectorAll('.sar-roster-person-tabs button')[npc === 'caian' ? 0 : 1];
        return tab?.getAttribute('aria-pressed') === 'true';
    }, npc);
    await page.locator('.sar-roster-detail-tabs button').nth(1).click();
}

async function enterRoster() {
    await button('SAR').waitFor();
    await button('SAR').click();
    await button('打开仓库').click();
    await page.getByTestId('sar-wallet-balance').waitFor();
    await button('打开收集图鉴').click();
    await button('名册').click();
    await page.locator('.sar-familiarity-roster').waitFor();
    await selectNpc('caian');
}

async function closeDialogue() {
    if (await page.locator('.srf-dialog').count()) {
        await button('离开对话').click();
        await page.locator('.srf-dialog').waitFor({ state: 'hidden' });
    }
}

async function openScene(scene) {
    await closeDialogue();
    await selectNpc(scene.npc);
    const row = button(`回顾${scene.title}`);
    // Other stars' authored rows remain inside native closed <details> groups.
    const group = row.locator('xpath=ancestor::details');
    if (await group.count() && await group.getAttribute('open') === null) await group.locator('summary').click();
    assert.equal(await row.isDisabled(), false, `${scene.id} should be available in DEV without collecting it`);
    await row.click();
    await waitDialogue(scene.id);
    assert.equal((await state()).replay, true);
    assert.equal((await state()).preview, true);
    await button('打开表情校对').click();
    await review().waitFor();
}

async function jump(point) {
    const value = `${point.nodeId}:${point.line}:${point.sentence}`;
    await review().getByRole('combobox', { name: '跳转台词', exact: true }).selectOption(value);
    await page.waitForFunction(point => {
        if (typeof window.render_game_to_text !== 'function') return false;
        const current = JSON.parse(window.render_game_to_text());
        return current.node === point.nodeId && current.line === point.line && current.sentence === point.sentence;
    }, point);
}

async function target(npc) {
    await review().getByRole('button', { name: npc === 'caian' ? '校对凯恩' : '校对艾文', exact: true }).click();
    const labels = await review().locator('button[aria-label^="表情："]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label').slice(3)));
    assert.deepEqual(labels.sort(), [...expressions[npc]].sort(), `Only ${npc}'s existing portraits may be offered`);
}

async function expectPortrait(npc, expression) {
    await page.waitForFunction(({ npc, expression }) => {
        const portrait = document.querySelector(`.srf-stage .cast-${npc} .sar-npc-portrait`);
        return portrait?.getAttribute('data-expression') === expression
            && !!portrait.querySelector('img:not(.sar-npc-portrait__pending)')?.naturalWidth
            && portrait.getAttribute('aria-busy') !== 'true';
    }, { npc, expression });
}

async function edit(npc, expression) {
    await target(npc);
    await review().getByRole('button', { name: `表情：${expression}`, exact: true }).click();
    await expectPortrait(npc, expression);
}

async function shot(name) {
    await page.waitForFunction(() => [...document.querySelectorAll('.srf-dialog .sar-npc-portrait')].every(element => element.getAttribute('aria-busy') !== 'true'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal page overflow`);
    if (await review().count()) {
        const rect = await review().boundingBox();
        const { width, height } = page.viewportSize();
        assert(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `${name}: review panel must stay inside the viewport`);
    }
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    screenshotNames.push(name);
}

function checkExport(payload, sourcePoints) {
    assert.equal(payload.version, 1);
    assert.equal(payload.kind, 'sar-expression-review');
    assert(payload.build && typeof payload.build.branch === 'string' && typeof payload.build.commit === 'string');
    assert(Array.isArray(payload.edits));
    assert.equal(payload.edits.length, sourcePoints.length, 'Global export must include all current edits and omit reverted edits');
    for (const point of sourcePoints) {
        const exported = payload.edits.find(item => item.sceneId === point.sceneId && item.nodeId === point.nodeId
            && item.line === point.line && item.sentence === point.sentence && item.npc === point.npc);
        assert(exported, `Missing exported address ${point.sceneId}/${point.nodeId}/${point.line}/${point.sentence}/${point.npc}`);
        assert.equal(exported.text, point.text, 'Export the original authored line, not the rendered/user-substituted text');
        assert.equal(exported.sentenceText, point.sentenceText);
        assert.equal(exported.before, point.before);
        assert.equal(exported.after, point.after);
        assert.equal(exported.stale, false);
        assert.equal(exported.sourcePath, `utils/vrWorld/sarFamiliarity/${point.sourceNpc}.ts`);
        assert(expressions[point.npc].includes(exported.after));
    }
    const serialized = JSON.stringify(payload);
    for (const marker of [privateName, privatePrompt, 'QA_PRIVATE_CATCH_ID', 'QA_PRIVATE_OWNER_NAME']) assert(!serialized.includes(marker), `Export must not contain fixture private data: ${marker}`);
    function noBusinessData(value) {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            assert(!['userProfile', 'characters', 'accounts', 'inventory', 'wallet', 'sarFamiliarity', 'apiKey', 'userName'].includes(key), `Unexpected business field in expression export: ${key}`);
            noBusinessData(child);
        }
    }
    noBusinessData(payload);
}

try {
    await page.goto(`${baseURL}/test/fixtures/kanata.html?npcs=show`);
    await button('SAR').waitFor();
    await page.evaluate(async ({ privateName, privatePrompt }) => {
        const debug=await import('/utils/devDebug.ts');debug.writeDevDebugFlags({...debug.readDevDebugFlags(),sarExpressionReview:true});
        const { DB } = await import('/utils/db.ts');
        const market = await import('/utils/vrWorld/fishingMarket.ts');
        const { ensureSARCommerce } = await import('/utils/vrWorld/sarCommerce.ts');
        const { freshFamiliarity } = await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');
        await DB.saveUserProfile({ ...await DB.getUserProfile(), name: privateName, vrState: { enabled: true, currentRoom: 'sar' } });
        await DB.saveCharacter({ id: 'qa-expression-private-character', name: 'QA_PRIVATE_OWNER_NAME', avatar: '', systemPrompt: privatePrompt,
            vrState: { enabled: false, activityMode: 'manual', intervalMinutes: 120 } });
        localStorage.setItem('vr_sar_club_state_v1', JSON.stringify({ version: 1, updateSeenVersion: 1, npcPreference: 'show', caianMet: true }));
        market.saveFishingMarketState({ ...market.createFishingMarketState(17), accounts: { user: 120 }, sarFamiliarity: freshFamiliarity(),
            inventory: [{ id: 'QA_PRIVATE_CATCH_ID', speciesId: 'glass-minnow', ownerId: 'user', ownerName: privateName, caughtAt: 1789084800000,
                weather: 'clear', weatherLabel: '晴', weatherSource: 'simulated', sizeCm: 11, quality: 1,
                origin: { kind: 'catch', actorId: 'user', actorName: privateName, at: 1789084800000 } }] });
        await ensureSARCommerce();
    }, { privateName, privatePrompt });
    await page.reload();
    await enterRoster();
    // Compare the provider's actual persisted bytes, including across normal application startup.
    canonicalBefore = await rawMarket();
    const catalog = await page.evaluate(async () => {
        const { CAIAN_SCENES } = await import('/utils/vrWorld/sarFamiliarity/caian.ts');
        const { AIVEN_SCENES } = await import('/utils/vrWorld/sarFamiliarity/aiven.ts');
        const { dialogueSentences, familiarityLineExpression } = await import('/utils/vrWorld/sarFamiliarity/dialogueText.ts');
        const scenes = [...CAIAN_SCENES, ...AIVEN_SCENES];
        const summaries = scenes.map(scene => ({ id: scene.id, npc: scene.npc, title: scene.title, rank: scene.rank }));
        const points = id => {
            const scene = scenes.find(item => item.id === id);
            return Object.entries(scene.nodes).flatMap(([nodeId, node]) => node.lines.flatMap((line, index) => dialogueSentences(line.text).map((sentenceText, sentence) => ({
                sceneId: scene.id, sourceNpc: scene.npc, nodeId, line: index, sentence, npc: line.speaker,
                text: line.text, sentenceText, before: familiarityLineExpression(line, sentence),
            }))));
        };
        return { summaries, caian: points('C1-01'), placeholder: points('C1-02'), aiven: points('A1-01') };
    });
    assert.equal(catalog.summaries.length, 84);
    for (const npc of ['caian', 'aiven']) {
        await selectNpc(npc);
        const expected = catalog.summaries.filter(scene => scene.npc === npc);
        assert.equal(await page.locator('.sar-roster-memory').count(), expected.length);
        assert.equal(await page.locator('.sar-roster-memory:disabled').count(), 0, `All ${npc} memories should be temporarily reviewable`);
        const current = await state();
        assert.equal(current.stars, 0);
        assert.deepEqual(current.completed, []);
    }
    await selectNpc('caian');
    await shot('01-dev-roster-390');
    await unchanged('opening all DEV memories');

    const first = catalog.caian.find(point => point.nodeId === 'start' && point.line === 0 && point.sentence === 0);
    const second = catalog.caian.find(point => point.nodeId === 'start' && point.line === 0 && point.sentence === 1);
    const otherNode = catalog.caian.find(point => point.nodeId !== 'start' && point.npc === 'caian');
    assert(first && second && otherNode, 'Fixture must exercise sentence boundaries within one authored line');
    first.after = editedValue('caian', first.before, [second.before]);
    await openScene(catalog.summaries.find(scene => scene.id === first.sceneId));
    await jump(first);
    await edit('caian', first.after);
    await shot('02-caian-edited-390');
    await jump(second);
    await expectPortrait('caian', second.before);
    await shot('03-next-sentence-390');
    await review().getByRole('button', { name: '上一句', exact: true }).click();
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).sentence === 0);
    await expectPortrait('caian', first.after);
    await jump(otherNode);
    await expectPortrait('caian', otherNode.before);
    await jump(second);
    await edit('caian', editedValue('caian', second.before));
    await review().getByRole('button', { name: '恢复这句原表情', exact: true }).click();
    await expectPortrait('caian', second.before);
    await jump(first);
    await expectPortrait('caian', first.after);
    await target('aiven'); // Inspect the legal choices without changing an absent guest.
    await target('caian');
    await unchanged('sentence editing, navigation, and reverting a different sentence');

    const placeholder = catalog.placeholder.find(point => point.npc === 'caian' && point.text.includes('（User名）'));
    assert(placeholder, 'Fixture must include an authored user-name placeholder');
    placeholder.after = editedValue('caian', placeholder.before);
    await openScene(catalog.summaries.find(scene => scene.id === placeholder.sceneId));
    await jump(placeholder);
    await edit('caian', placeholder.after);

    const aiven = catalog.aiven.find(point => point.npc === 'aiven');
    aiven.after = editedValue('aiven', aiven.before);
    await openScene(catalog.summaries.find(scene => scene.id === aiven.sceneId));
    await jump(aiven);
    await edit('aiven', aiven.after);
    assert.equal(await page.locator('.sar-dialogue-choices').count(), 0, 'Reviewing expressions must not cover the portrait with story choices');
    const storyChoices = review().getByRole('group', { name: '校对中选择回应', exact: true });
    await review().locator('.sar-expression-choices summary').click();
    assert.equal(await storyChoices.getByRole('button').count(), 3);
    await storyChoices.getByRole('button').first().click();
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).node !== 'start');
    await review().getByRole('button', { name: '上一句', exact: true }).click();
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).node === 'start');
    await expectPortrait('aiven', aiven.after);
    await review().locator('.sar-expression-review-scroll').evaluate(element => element.scrollTo(0, 0));
    await shot('04-aiven-edited-390');
    await page.setViewportSize({ width: 320, height: 740 });
    await edit('aiven', 'sleeping');
    await edit('aiven', aiven.after);
    await shot('05-review-320');
    await page.setViewportSize({ width: 1100, height: 850 });
    await shot('06-review-1100');
    await unchanged('editing both NPCs and resizing');

    const expectedEdits = [first, placeholder, aiven];
    await review().getByRole('button', { name: '复制修改清单', exact: true }).click();
    await page.waitForFunction(() => !!window.__sarReviewClipboard);
    const copied = JSON.parse(await page.evaluate(() => window.__sarReviewClipboard));
    checkExport(copied, expectedEdits);
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        review().getByRole('button', { name: '下载修改清单', exact: true }).click(),
    ]);
    assert.equal(download.suggestedFilename(), 'SAR-两人表情修改.json');
    const downloadPath = `${out}/expression-review-export.json`;
    await download.saveAs(downloadPath);
    const exported = JSON.parse(readFileSync(downloadPath, 'utf8'));
    checkExport(exported, expectedEdits);
    assert.deepEqual(exported.edits, copied.edits, 'Copy and download must export the same global edit list');
    await unchanged('copy and download');

    await page.reload();
    await enterRoster();
    await openScene(catalog.summaries.find(scene => scene.id === first.sceneId));
    await jump(first);
    await expectPortrait('caian', first.after);
    await jump(second);
    await expectPortrait('caian', second.before);
    await jump(first);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('07-restored-after-refresh-390');
    await page.setViewportSize({ width: 320, height: 740 });
    await edit('caian', 'aboutaster');
    await edit('caian', first.after);
    await shot('08-caian-review-320');
    await review().getByRole('button', { name: '恢复这句原表情', exact: true }).click();
    await expectPortrait('caian', first.before);
    await review().getByRole('button', { name: '复制修改清单', exact: true }).click();
    const afterReset = JSON.parse(await page.evaluate(() => window.__sarReviewClipboard));
    checkExport(afterReset, [placeholder, aiven]);
    await unchanged('reload and reverting the current sentence');
    const scopedStorage = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('sullyos.devDebug.sarExpressionReview.v1.')));
    assert.equal(scopedStorage.length, 1, 'Expression edits must use the separate branch-scoped DEV store');
    assert.deepEqual(pageErrors, []);
    const result = { passed: true, memoriesAvailable: 84, canonicalBytesUnchanged: true, expressionSets: expressions,
        exportedEditsBeforeReset: 3, exportedEditsAfterReset: 2, branchingWhileEditing: true, screenshots: screenshotNames, pageErrors };
    writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
    for (const file of ['failure.json', 'failure.png']) rmSync(`${out}/${file}`, { force: true });
    console.log('SAR expression review integration passed: 84 previews, sentence isolation, persistent edits, private-free exports and byte-identical market');
} catch (error) {
    await page.screenshot({ path: `${out}/failure.png`, animations: 'disabled' }).catch(() => {});
    const visibleText = await page.locator('body').innerText().catch(() => '');
    writeFileSync(`${out}/failure.json`, JSON.stringify({ error: String(error), visibleText, pageErrors, consoleErrors, failedRequests }, null, 2));
    console.error(visibleText.slice(-7000));
    throw error;
} finally {
    await browser.close();
}
