import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='output/fishing-qa/sar-commerce';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
await context.addInitScript(() => { for (const facility of ['gacha', 'modules']) localStorage.setItem(`sar-facility-guide-${facility}-v1`, 'done'); });
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});});
const base=`${process.env.SAR_QA_URL||'http://127.0.0.1:5177'}/test/fixtures/sar-commerce.html`;
const btn=name=>page.getByRole('button',{name,exact:true});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
const backToIdle=async()=>{await btn('打开扭蛋').click();await btn('再看看机器').click();};
try{
    await page.goto(base+'?open=gacha');await page.waitForFunction(()=>!document.querySelector('.sarg-draw-button')?.disabled);
    assert(!(await page.locator('body').innerText()).includes('无限抽取'));
    await shot('01-free');
    await page.locator('.sarg-draw-button').evaluate(el=>{el.click();el.click();});
    await btn('打开扭蛋').waitFor();assert.equal((await read()).ledger.length,1);assert.equal((await read()).accounts.user,200);
    await backToIdle();await shot('02-paid');
    assert((await page.locator('.sarg-draw-button').innerText()).includes('90 鳞币'));
    await page.locator('.sarg-draw-button').click();await btn('打开扭蛋').waitFor();assert.equal((await read()).accounts.user,110);
    // Closing before reveal must not discard an already granted item.
    await btn('离开扭蛋机').click();await page.reload();await btn('打开扭蛋').waitFor({state:'hidden'});
    assert.equal(Object.values((await read()).sarCommerce.gacha.collection).reduce((a,b)=>a+b,0),2);
    await btn('离开扭蛋机').click();await btn('打开商店').click();await page.waitForFunction(()=>document.querySelector('.sar-module-shop__currency')?.textContent.includes('110'));
    await shot('03-shop');
    const id=(await read()).sarCommerce.moduleShop.market.offerIds[0];
    const price=await page.evaluate(async id=>(await import('/utils/vrWorld/sarModuleShop.ts')).getSARModuleById(id).price,id);
    await page.locator('.sar-module-card').first().click();await shot('04-buy');
    assert((await page.locator('.sar-module-buy').innerText()).includes('鳞币'));
    await page.locator('.sar-module-buy').evaluate(el=>{el.click();el.click();});
    await page.waitForFunction(id=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarCommerce.moduleShop.inventory[id]===1,id);
    assert.equal((await read()).accounts.user,110-price);await shot('05-receipt');
    await page.reload();await btn('离开扭蛋机').click();await btn('打开商店').click();
    await page.waitForFunction(()=>document.querySelector('.sar-module-card'));
    assert.equal((await read()).sarCommerce.moduleShop.inventory[id],1);
    await page.getByRole('tab',{name:/模块袋/}).click();await page.locator('.sar-module-card').first().click();
    await page.locator('.sar-module-buy').click();await btn('继续').click();
    const installGeometry=[];
    for(const viewport of [{width:390,height:844},{width:320,height:568},{width:740,height:390}]){
        await page.setViewportSize(viewport);await btn('确认装载').scrollIntoViewIfNeeded();
        // Scroll the sheet itself to expose its full bottom safe area.
        await page.locator('.sar-module-install__sheet').evaluate(el=>el.scrollTop=el.scrollHeight);
        const box=await btn('确认装载').boundingBox();
        assert(box.height>=44,'install target remains at least 44px tall');
        assert(box.y>=0&&box.y+box.height<=viewport.height-79,'install stays clear of safe area and three-line build badge');
        installGeometry.push({viewport,box});await shot('install-'+viewport.width);
    }
    writeFileSync(out+'/install-geometry.json',JSON.stringify(installGeometry,null,2));
    await page.setViewportSize({width:390,height:844});
    const balanceBeforeInstall=(await read()).accounts.user;
    await btn('确认装载').click();await page.getByRole('heading',{name:'装载完成',exact:true}).waitFor();
    assert.equal((await read()).sarCommerce.moduleShop.inventory[id],undefined);assert.equal((await read()).accounts.user,balanceBeforeInstall);
    await page.waitForFunction(async()=>{const {DB}=await import('/utils/db.ts');return (await DB.getAllCharacters()).find(c=>c.id==='commerce-char')?.vrState?.sarModule?.phase==='active';});
    await btn('返回模块袋').click();await page.getByRole('tab',{name:/今日货架/}).click();
    // Shared wallet updates from another tab are reflected without reopening the shop.
    const other=await context.newPage();await other.goto(base);
    await other.evaluate(async()=>{const m=await import('/utils/vrWorld/fishingMarket.ts');await m.mutateFishingMarket(s=>({...s,accounts:{...s.accounts,user:0}}));});
    await page.waitForFunction(()=>document.querySelector('.sar-module-shop__currency')?.textContent==='0鳞币');
    await page.locator('.sar-module-card').first().click();assert(await page.locator('.sar-module-buy').isDisabled());await shot('06-insufficient');
    await btn('关闭模块详情').click();await btn('离开模块商店').click();await btn('打开抽卡').click();
    await page.waitForFunction(()=>document.querySelector('.sarg-draw-button')?.disabled===true);await shot('07-gacha-empty');
    // A still-free pool remains available at zero balance.
    await page.getByRole('tab').nth(1).click();await page.waitForFunction(()=>!document.querySelector('.sarg-draw-button')?.disabled);
    await page.locator('.sarg-draw-button').click();await btn('打开扭蛋').waitFor();assert.equal((await read()).accounts.user,0);
    await backToIdle();
    // Stored wallet and inventory are untouched if the final write fails.
    await other.evaluate(async()=>{const m=await import('/utils/vrWorld/fishingMarket.ts');await m.mutateFishingMarket(s=>({...s,accounts:{...s.accounts,user:100}}));});
    await page.waitForFunction(()=>!document.querySelector('.sarg-draw-button')?.disabled);
    const before=await read();
    await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='vr_fishing_market_v1')throw new DOMException('无法保存','QuotaExceededError');return window.qaSetItem.call(this,key,value);};});
    await page.locator('.sarg-draw-button').click();await page.getByRole('alert').waitFor();assert.deepEqual(await read(),before);
    await shot('08-save-failure');await page.evaluate(()=>{Storage.prototype.setItem=window.qaSetItem;});
    await page.setViewportSize({width:320,height:740});await shot('09-small');
    await page.locator('.sarg-draw-button').click();await btn('打开扭蛋').waitFor();assert.equal((await read()).accounts.user,10);
    await other.evaluate(async()=>{const m=await import('/utils/vrWorld/fishingMarket.ts');await m.mutateFishingMarket(s=>({...s,accounts:{...s.accounts,user:90}}));});
    const concurrent=await Promise.all([page,other].map((tab,i)=>tab.evaluate(async id=>{const m=await import('/utils/vrWorld/sarCommerce.ts');try{await m.drawSARModuleWithPayment('story',{requestId:id,maxCost:90});return true;}catch{return false;}},`two-tabs-${i}`)));
    assert.equal(concurrent.filter(Boolean).length,1,'two pages cannot spend the same final 90 coins');assert.equal((await read()).accounts.user,0);
    assert.deepEqual(errors,[]);writeFileSync(`${out}/result.json`,JSON.stringify({errors,checks:['free and paid draws','double click','close before reveal','module purchase','reload','cross-tab balance','insufficient balance','zero-balance free pool','atomic storage failure','320px']},null,2));
    console.log('SAR commerce UI passed: costs, grants, duplicate clicks, reload, shared wallet and storage failure.');
}finally{await browser.close();}
