import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='output/sar-module-chat';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],modelCalls=[];page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.includes('/chat/completions'))modelCalls.push(url.pathname);return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});});
const read=()=>page.evaluate(async()=>{const {DB}=await import('/utils/db.ts');return DB.getRecentMessagesByCharId('qa-sar-module-sticker',50);});
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});
try{
    await page.goto(`${process.env.SAR_QA_URL||'http://127.0.0.1:5173'}/test/fixtures/sar-module-chat.html`);
    await page.locator('.qa-message').nth(10).waitFor();assert.equal(await page.locator('.qa-message').count(),11);
    const before=await read();assert.equal(before[8].type,'emoji');assert.equal(before[8].metadata?.sarModuleSurface,undefined);
    await page.locator('.qa-message').nth(8).locator('img').waitFor();assert((await page.locator('.qa-message').nth(9).innerText()).includes('此刻，瞬息，即刻。'));
    assert((await page.locator('.qa-message').nth(10).innerText()).includes('把这诅咒之物给我剥离！'));await shot('surface-390');
    const toggles=page.getByRole('button',{name:'查看原台词',exact:true});assert.equal(await toggles.count(),9);
    while(await toggles.count())await toggles.first().click();
    assert((await page.locator('.qa-message').nth(9).innerText()).includes('现在，立刻，马上。'));assert((await page.locator('.qa-message').nth(10).innerText()).includes('把这破插件给我卸了！'));
    assert.equal(await page.locator('.qa-message').count(),11);await shot('truth-390');assert.deepEqual(await read(),before,'truth toggle changes no saved content');
    await page.setViewportSize({width:320,height:680});await page.reload();await page.locator('.qa-message').nth(10).waitFor();await shot('surface-320');
    assert((await page.locator('.qa-message').nth(10).innerText()).includes('把这诅咒之物给我剥离！'));assert.deepEqual(await read(),before,'reload retains the same paired messages');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(modelCalls,[]);
    writeFileSync(`${out}/result.json`,JSON.stringify({messages:before.length,emojiIndex:8,truthToggles:9,errors,modelCalls},null,2));console.log('SAR module chat passed: 11 messages, sticker at 9, final surface/truth intact, reload and 320px.');
}catch(error){await shot('failure');console.error((await page.locator('body').innerText()).slice(-1500));throw error;}finally{await browser.close();}
