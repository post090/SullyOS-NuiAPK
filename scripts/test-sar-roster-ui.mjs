import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const out='output/fishing-qa/npc-lines/roster';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    const portrait=url.pathname.match(/\/SAR\/(Caian|Aiven)\/([^/]+\.png)$/);
    if(portrait)return route.fulfill({contentType:'image/png',body:await readFile(`output/fishing-qa/npc-lines/original-portraits/${portrait[1]}/${portrait[2]}`)});
    return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});
});
const button=name=>page.getByRole('button',{name,exact:true});
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});};
const scrollTo=async selector=>page.locator(selector).scrollIntoViewIfNeeded();
const portraitReady=async name=>{await page.getByRole('img',{name:`${name}立绘`,exact:true}).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.sar-npc-portrait__image:not(.sar-npc-portrait__pending)')].every(img=>img.complete&&img.naturalWidth>0));};
try{
    await page.goto('http://127.0.0.1:5177/test/fixtures/sar-roster.html');
    const data=await page.evaluate(async()=>{
        const {freshFamiliarity}=await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts'),{CAIAN_SCENES}=await import('/utils/vrWorld/sarFamiliarity/caian.ts'),{AIVEN_SCENES}=await import('/utils/vrWorld/sarFamiliarity/aiven.ts'),{readFishingMarketState,saveFishingMarketState}=await import('/utils/vrWorld/fishingMarket.ts');
        const state=freshFamiliarity(),at=Date.UTC(2026,8,11);
        state.npcs.caian.stars=1;state.npcs.aiven.stars=2;
        CAIAN_SCENES.filter(s=>(s.rank===1&&(s.kind==='topic'||s.kind==='event'))||s.id==='C2-01').forEach(s=>state.npcs.caian.completed[s.id]={at,flags:{}});
        AIVEN_SCENES.filter(s=>(s.rank<=2&&(s.kind==='topic'||s.kind==='event'))||s.id==='A1-E01').forEach(s=>state.npcs.aiven.completed[s.id]={at,flags:{}});
        const market=readFishingMarketState();market.sarFamiliarity=state;saveFishingMarketState(market);
        return {caianCount:Object.keys(state.npcs.caian.completed).length,aivenCount:Object.keys(state.npcs.aiven.completed).length,caianFirst:CAIAN_SCENES[0],caianEvent:CAIAN_SCENES.find(s=>s.id==='C1-SPECIAL'),caianLocked:CAIAN_SCENES.find(s=>s.id==='C2-SPECIAL')};
    });
    await page.getByRole('combobox',{name:'图鉴主人'}).selectOption('qa-visitor');await button('名册').click();await portraitReady('凯恩');
    await page.getByRole('img',{name:'熟悉度 1 / 5 星',exact:true}).waitFor();assert.equal(await page.getByRole('combobox',{name:'图鉴主人'}).count(),0);
    assert.equal(await page.locator('.sar-roster-stars svg').count(),5);assert.equal(await page.locator('.sar-roster-stars .is-lit').count(),1);
    assert((await page.locator('.sar-roster-biography').innerText()).includes('似乎对人工人格与 AI 有一些不同寻常的执着。'));
    await shot('01-caian-profile-390');
    await button(`回忆 ${data.caianCount}`).click();await scrollTo('.sar-roster-memories');await shot('02-caian-memories-390');
    assert(await button('二星事件 · 尚未解锁').isDisabled());assert.equal(await page.getByText(data.caianLocked.title,{exact:true}).count(),0);
    assert((await page.locator('.sar-roster-coming').innerText()).includes('四星、五星故事尚未开放'));
    await button(`回顾${data.caianEvent.title}`).click();assert.deepEqual(await page.evaluate(()=>window.qaLastReplay),{npc:'caian',sceneId:'C1-SPECIAL'});await button('关闭回放入口').click();
    await page.locator('.sar-roster-topic-group').first().locator('summary').click();await button(`回顾${data.caianFirst.title}`).click();assert.deepEqual(await page.evaluate(()=>window.qaLastReplay),{npc:'caian',sceneId:'C1-01'});await button('关闭回放入口').click();
    await page.getByRole('button',{name:/02\s*艾文\s*Aiven/}).click();await portraitReady('艾文');await page.getByRole('img',{name:'熟悉度 2 / 5 星',exact:true}).waitFor();await button('人物档案').click();
    assert((await page.locator('.sar-roster-biography').innerText()).includes('“……字泡掉了。”'));await shot('03-aiven-profile-390');
    await button(`回忆 ${data.aivenCount}`).click();await scrollTo('.sar-roster-memories');await shot('04-aiven-memories-390');
    await button('回顾没有名字的角色卡').click();assert.deepEqual(await page.evaluate(()=>window.qaLastReplay),{npc:'aiven',sceneId:'A1-E01'});await button('关闭回放入口').click();
    // Storage broadcasts refresh this global record without changing the selected NPC.
    await page.evaluate(async()=>{const {readFishingMarketState,saveFishingMarketState}=await import('/utils/vrWorld/fishingMarket.ts');const state=readFishingMarketState();state.sarFamiliarity.npcs.aiven.completed['A3-01']={at:Date.now(),flags:{}};saveFishingMarketState(state);});
    assert.equal((await page.evaluate(()=>JSON.parse(window.render_game_to_text()))).npc,'aiven');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completed.includes('A3-01'));
    await page.getByRole('navigation',{name:'图鉴页面'}).getByRole('button',{name:'收藏',exact:true}).click();await page.getByRole('heading',{name:'收集图鉴',exact:true}).waitFor();assert.equal(await page.getByRole('combobox',{name:'图鉴主人'}).inputValue(),'qa-visitor');
    await button('名册').click();await portraitReady('凯恩');await page.keyboard.press('Escape');await page.getByText('已返回随身仓库',{exact:true}).waitFor();
    for(const width of [320,1100]){
        await page.setViewportSize({width,height:width===320?740:900});await page.reload();await button('名册').click();await portraitReady('凯恩');await shot(`05-profile-${width}`);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await button(`回忆 ${data.caianCount}`).click();await scrollTo('.sar-roster-memories');await shot(`06-memories-${width}`);
    }
    await page.evaluate(async()=>{const {readFishingMarketState,saveFishingMarketState}=await import('/utils/vrWorld/fishingMarket.ts');const {freshFamiliarity}=await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');const state=readFishingMarketState();state.sarFamiliarity=freshFamiliarity();saveFishingMarketState(state);});
    await page.getByRole('img',{name:'熟悉度 0 / 5 星',exact:true}).waitFor();assert.equal(await page.locator('.sar-roster-memory.is-complete').count(),0);assert.equal(await page.locator('.sar-roster-stars .is-lit').count(),0);
    await page.setViewportSize({width:390,height:844});await shot('07-new-player-locked');
    assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({errors,checks:['full supplied biographies','original portraits','five-star display','completed-only replay callback','hidden unrevealed titles','global owner-independent progress','live storage refresh','two-level back chain','320/390/1100 px','zero-progress locked state']},null,2));
    console.log('SAR roster: profiles, records, callback, owner isolation, keyboard back and three viewports passed.');
}finally{await page.screenshot({path:`${out}/last.png`}).catch(()=>{});await browser.close();}
