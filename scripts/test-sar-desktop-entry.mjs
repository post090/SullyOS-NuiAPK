import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='output/sar-desktop-entry';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),base=process.env.SAR_QA_URL||'http://127.0.0.1:5173';
const errors=[],results=[];
try{
    for(const skin of ['mobilegame','tamagotchi','companion']){
        const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
        await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`${base}/test/fixtures/sar-release.html?backup`);
        await page.waitForFunction(()=>window.releaseQA?.isDataLoaded);
        // Use a static test character, avoiding video/model startup during a navigation test.
        await page.evaluate(async()=>{
            const {DB}=await import('/utils/db.ts');
            const char={...window.releaseQA.characters[0],id:'qa-desktop-entry',name:'测试角色',videoAvatar:undefined,companionAvatar:undefined,avatar:'/assets/sar/caian-chibi.png'};
            await DB.saveCharacter(char);window.releaseQA.setActiveCharacterId(char.id);
        });
        await page.goto(`${base}/test/fixtures/sar-release.html?desktop=${skin}`);
        const button=page.getByRole('button',{name:/彼方/}).first();await button.waitFor({timeout:60000});
        await page.waitForTimeout(500);
        await button.scrollIntoViewIfNeeded();
        const box=await button.boundingBox();assert(box && box.y>=0 && box.y+box.height<=844, `${skin}: entry must be on the desktop`);
        await page.screenshot({path:`${out}/${skin}.png`,animations:'disabled'});
        await button.click();
        await page.waitForFunction(()=>window.releaseQA?.activeApp==='vrworld');
        assert.equal(await page.locator('output[data-active-app]').getAttribute('data-active-app'),'vrworld');
        results.push({skin,destination:'vrworld'});await context.close();
    }
    assert.deepEqual(errors,[]);writeFileSync(`${out}/report.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
