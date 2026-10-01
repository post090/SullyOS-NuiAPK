import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'output/fishing-qa/market';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort();
});
const button = name => page.getByRole('button', { name, exact: true });
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
const screenshot = async name => {
    await page.waitForFunction(() => [...document.querySelectorAll('.board-page')].every(el => getComputedStyle(el).opacity === '1'));
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
};
const close = () => button('返回上一页').click();
try {
    await page.goto((process.env.FISHING_QA_URL || 'http://127.0.0.1:5177') + '/test/fixtures/fishing.html?entry=board');
    await button('写便笺').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.fishing-shell')).position === 'fixed');
    await page.evaluate(async () => {
        const m = await import('/utils/vrWorld/fishingMarket.ts');
        const user = { id: 'user', name: '钓鱼测试员', kind: 'user' };
        const seller = { id: 'wanderer:qa', name: '测试路人', kind: 'wanderer' };
        await m.mutateFishingMarket(s => {
            s = m.ensureActorAccounts(s, [user, seller]);
            const caught = { speciesId: 'glass-minnow', ownerId: user.id, ownerName: user.name, caughtAt: Date.now(), weather: 'clear', weatherLabel: '晴', weatherSource: 'simulated', sizeCm: 22, quality: 3 };
            s = m.addCatchToState(s, { ...caught, id: 'keep-rare' });
            s = m.addCatchToState(s, { ...caught, id: 'give-common', sizeCm: 30, quality: 1 });
            s = m.addCatchToState(s, { ...caught, id: 'stale-choice', sizeCm: 42, quality: 2 });
            s = m.createListing(s, seller, null, 7, '只有一段约定', Date.now(), '玻璃米鱼');
            s = m.createRequest(s, seller, 'glass-minnow', '想要一条鱼', 30, '请挑一条愿意送出的');
            s = m.createRequest(s, seller, undefined, '路人的打赏', 25, '谢谢', Date.now(), 'tip');
            s = m.createRequest(s, seller, undefined, '一句鼓励', 15, '请说一句', Date.now(), 'favor');
            s = m.createListing(s, user, null, 0, '早期便笺', Date.now() - m.MARKET_DAY_MS - 1000, '昨天的便笺');
            return s;
        });
    });
    await screenshot('01-board');
    assert.equal(await button('让 ta 逛布告板').count(), 0);
    assert.equal(await button('看看路人').count(), 0);
    await button('布告板更多').click();
    await page.getByRole('button', { name: /当日行情/ }).click();
    await page.getByRole('heading', { name: '当日行情', exact: true }).waitFor();
    await screenshot('01b-prices');
    await button('返回更多').click();
    await button('返回布告板').click();

    // Reading a note and visiting a subpage must preserve the board's scroll position.
    await page.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const readingPosition = await page.locator('main').evaluate(el => el.scrollTop);
    await page.locator('.board-note').last().click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('main').evaluate(el => el.scrollTop), readingPosition);
    await button('布告板更多').click();
    await button('返回布告板').click();
    assert.equal(await page.locator('main').evaluate(el => el.scrollTop), readingPosition);
    await button('写便笺').click();
    await page.getByLabel('便笺标题').fill('取消的便笺');
    await page.keyboard.press('Escape');
    assert.equal((await read()).requests.some(p => p.itemLabel === '取消的便笺'), false);

    await button('写便笺').click();
    await page.getByLabel('便笺用途', { exact: true }).selectOption('listing');
    await page.getByLabel('便笺标题').fill('一声晚安');
    await page.getByLabel('金额', { exact: true }).fill('0');
    await page.getByText('署名 · 钓鱼测试员', { exact: true }).click();
    await page.getByLabel('匿名笔名').fill('月亮交易员');
    await button('贴上布告板').click();
    await page.getByRole('button', { name: /转让.*一声晚安/ }).click();
    await page.getByLabel('回复或交付内容').fill('还在哦');
    await button('仅回复').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('vr_fishing_market_v1')).listings.some(p => p.comments.length));
    const anonymous = (await read()).listings.find(p => p.itemLabel === '一声晚安');
    assert.equal(anonymous.comments[0].alias, '月亮交易员');
    assert.equal(await page.getByRole('dialog', { name: '一声晚安', exact: true }).getByText('钓鱼测试员', { exact: true }).count(), 0);
    await screenshot('02-anonymous-reply');
    await button('撤下并存档').click();
    await close();

    await page.getByRole('button', { name: /转让.*玻璃米鱼/ }).click();
    await page.getByText('文字商品 · 自愿交易，不会获得实体藏品。', { exact: true }).waitFor();
    await button('支付 7 鳞币，买下').click();
    await page.getByText('成交买家：钓鱼测试员', { exact: true }).waitFor();
    assert.equal((await read()).accounts.user, 993);
    assert.equal((await read()).inventory.length, 3);
    await close();

    await page.getByRole('button', { name: /求物.*想要一条鱼/ }).click();
    assert.equal(await button('交付并领取 30 鳞币').isDisabled(), true);
    const selector = page.getByLabel('选择交付的藏品', { exact: true });
    await selector.selectOption('stale-choice');
    await page.evaluate(async () => {
        const m = await import('/utils/vrWorld/fishingMarket.ts');
        await m.mutateFishingMarket(s => m.createListing(s, { id: 'user', name: '钓鱼测试员', kind: 'user' }, s.inventory.find(c => c.id === 'stale-choice'), 50));
    });
    await page.waitForFunction(() => document.querySelector('[aria-label="选择交付的藏品"]').options.length === 3);
    assert.equal(await button('交付并领取 30 鳞币').isDisabled(), true);
    await selector.selectOption('give-common');
    await screenshot('03-select-specimen');
    await page.setViewportSize({ width: 320, height: 740 });
    await screenshot('04-select-specimen-small');
    await button('交付并领取 30 鳞币').click();
    await page.getByText('已交付：玻璃米鱼 · 30 cm · 1 星', { exact: true }).waitFor();
    let state = await read();
    assert.equal(state.inventory.find(c => c.id === 'keep-rare').ownerId, 'user');
    assert.equal(state.inventory.find(c => c.id === 'give-common').ownerId, 'wanderer:qa');
    assert.equal(state.accounts.user, 1023);
    await screenshot('05-delivered');
    await close();
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole('button', { name: /收心意.*路人的打赏/ }).click();
    await page.getByLabel('回复或交付内容').fill('围观一下');
    await button('仅回复').click();
    assert.equal((await read()).accounts.user, 1023);
    await button('赠予 25 鳞币').click();
    await page.getByText('打赏人：钓鱼测试员', { exact: true }).waitFor();
    assert.equal((await read()).accounts.user, 998);
    assert.equal(await button('赠予 25 鳞币').count(), 0);
    await close();
    await page.getByRole('button', { name: /求回应.*一句鼓励/ }).click();
    await button('提交并领取 15 鳞币').click();
    await page.getByRole('dialog', { name: '一句鼓励', exact: true }).getByRole('alert').waitFor();
    assert.equal((await read()).accounts.user, 998);
    await page.getByLabel('回复或交付内容').fill('明天也会有好事。');
    await button('提交并领取 15 鳞币').click();
    await page.getByText('交付内容：明天也会有好事。', { exact: true }).waitFor();
    assert.equal((await read()).accounts.user, 1013);
    await close();

    await page.evaluate(async () => {
        const m = await import('/utils/vrWorld/fishingMarket.ts');
        const user = { id: 'user', name: '钓鱼测试员', kind: 'user' };
        const seller = { id: 'wanderer:qa', name: '测试路人', kind: 'wanderer' };
        await m.mutateFishingMarket(s => {
            s = m.createRequest(s, user, 'glass-minnow', '收回那条鱼', 10, '保存交付档案');
            return m.fulfillRequest(s, s.requests.at(-1).id, seller, '送回来啦', Date.now(), 'give-common');
        });
    });
    await button('布告板更多').click();
    await page.getByRole('button', { name: /往期便笺/ }).click();
    await page.getByRole('button', { name: /昨天的便笺/ }).waitFor();
    await page.getByRole('button', { name: /收回那条鱼/ }).click();
    await page.getByText('交付人：测试路人', { exact: true }).waitFor();
    await page.getByText('已交付：玻璃米鱼 · 30 cm · 1 星', { exact: true }).waitFor();
    await screenshot('06-archive');
    state = await read();
    await page.reload();
    await button('写便笺').waitFor();
    assert.deepEqual((await read()).accounts, state.accounts);
    assert.deepEqual((await read()).inventory, state.inventory);
    assert.deepEqual((await read()).requests, state.requests);

    // All publishing paths remain reachable through the single compose page.
    const balanceBeforePublishing = (await read()).accounts.user;
    for (const [kind, label] of [['favor', '子页面回应'], ['item', '玻璃米鱼'], ['tip', '子页面心意'], ['listing', '玻璃米鱼']]) {
        await button('写便笺').click();
        assert.equal(await button('布告板更多').count(), 0, 'parent controls hidden in subpage');
        await page.getByLabel('便笺用途', { exact: true }).selectOption(kind);
        if (kind === 'item') await page.getByLabel('需要的物种').selectOption('glass-minnow');
        else if (kind === 'listing') await page.getByLabel('商品').selectOption('keep-rare');
        else await page.getByLabel('便笺标题').fill(label);
        await page.getByLabel('便笺正文').fill('从统一入口发布');
        await page.getByLabel('金额', { exact: true }).fill('18');
        await page.setViewportSize({ width: 320, height: 740 });
        await screenshot(`07-compose-${kind}`);
        await button('贴上布告板').click();
        await button('写便笺').waitFor();
        const published = kind === 'listing' ? (await read()).listings.at(-1) : (await read()).requests.at(-1);
        assert.equal(published.itemLabel, label);
        if (kind === 'listing') assert.equal(published.catchId, 'keep-rare');
        else assert.equal(published.kind, kind);
        assert.equal((await read()).accounts.user, balanceBeforePublishing, 'publishing does not transfer funds');
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await screenshot('08-board-desktop');

    // A collection can enter the same compose page, cancel back, then publish to the board.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto((process.env.FISHING_QA_URL || 'http://127.0.0.1:5177') + '/test/fixtures/fishing.html?entry=water');
    await button('图鉴').click();
    await page.getByRole('button', { name: /玻璃米鱼.*30 cm/ }).click();
    await button('自己定价挂板').click();
    assert.equal(await page.getByLabel('便笺用途', { exact: true }).inputValue(), 'listing');
    assert.equal(await page.getByLabel('商品').inputValue(), 'give-common');
    await close();
    await button('图鉴').waitFor();
    await page.getByRole('button', { name: /玻璃米鱼.*30 cm/ }).click();
    await button('自己定价挂板').click();
    await page.getByLabel('金额', { exact: true }).fill('55');
    await button('贴上布告板').click();
    await button('写便笺').waitFor();
    const collectionListing = (await read()).listings.at(-1);
    assert.equal(collectionListing.catchId, 'give-common');
    assert.equal(collectionListing.price, 55);
    assert.equal((await read()).inventory.find(c => c.id === 'give-common').ownerId, 'user');
    await screenshot('09-collection-to-board');
    assert.deepEqual(errors, []);
    writeFileSync(`${out}/result.json`, JSON.stringify({ errors, balance: state.accounts.user, checks: ['anonymous reply', 'text purchase', 'explicit specimen', 'stale specimen', 'tip', 'favor', 'archive', 'expiry', 'reload', 'scroll restoration', 'Escape', 'compose cancel', 'all four publishing paths', 'collection to board', '320px', '390px', '1024px'] }, null, 2));
    console.log('Market UI passed: aliases, exact specimens, transactions, archives, expiry, reload and mobile layouts.');
} finally {
    await browser.close();
}
