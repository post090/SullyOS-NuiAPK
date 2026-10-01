import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='output/sar-npc-off';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
await context.addInitScript(()=>{for(const f of ['warehouse','gacha','garden'])localStorage.setItem(`sar-facility-guide-${f}-v1`,'done');});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
try{
    await page.goto('http://127.0.0.1:5177/test/fixtures/kanata.html?npcs=show');
    await button('SAR').click();await button('打开仓库').waitFor();
    await page.evaluate(async()=>{
        const {DB}=await import('/utils/db.ts');
        const user=await DB.getUserProfile() || {name:'测试用户'};await DB.saveUserProfile({...user,vrState:{...user.vrState,title:'湖畔旅人'}});
        const m=await import('/utils/vrWorld/fishingMarket.ts'),f=await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');
        await m.mutateFishingMarket(s=>{const state=f.freshFamiliarity();state.unlocks=['titles','eggs'];state.npcs.aiven.stars=3;return {...s,sarFamiliarity:state};});
    });
    await page.reload();await button('SAR').click();await button('打开仓库').click();
    await button('修改彼方称号').waitFor();await button('打开收集图鉴').click();await button('名册').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarFamiliarity);
    const other=await context.newPage();await other.goto('http://127.0.0.1:5177/test/fixtures/kanata.html');
    await other.evaluate(async()=>{const m=await import('/utils/vrWorld/sarClub.ts');m.patchSARClubState({npcPreference:'hide'});});
    await page.waitForFunction(()=>document.querySelector('.sar-collection-sections')?.textContent==='收藏');
    assert.equal(await button('专属纪念').count(),0);assert.equal(await button('名册').count(),0);
    assert.equal(await page.locator('.sar-roster').count(),0);
    await page.screenshot({path:out+'/collection-off.png'});
    await button('返回随身仓库').click();assert.equal(await button('修改彼方称号').count(),0);assert.equal(await button('纪念').count(),0);
    await page.screenshot({path:out+'/warehouse-off.png'});
    await button('返回活动室').click();assert.equal(await page.locator('.sar-room-person__title').count(),0);
    await button('活动室设置').click();assert.equal(await page.getByText('初见回档',{exact:true}).count(),0);
    await page.getByRole('switch',{name:'显示常驻 NPC'}).click();
    await button('返回活动室').click();await button('打开仓库').click();await button('修改彼方称号').waitFor();
    await button('打开收集图鉴').click();await button('名册').waitFor();await button('专属纪念').waitFor();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarFamiliarity),saved);
    assert.deepEqual(errors,[]);writeFileSync(out+'/ui-result.json',JSON.stringify({checks:['cross-tab opt-out','roster exits','title editor hidden','keepsakes hidden','room titles hidden','reenable restores progress'],errors},null,2));
    console.log('SAR NPC off UI passed');
}finally{await browser.close();}
