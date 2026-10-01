import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/fishing-character-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.FISHING_BROWSER_CHANNEL||'chrome'});
const base=process.env.FISHING_QA_URL||'http://127.0.0.1:5182';
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[],consoleErrors=[];let calls=0;let response={disposition:'keep',reaction:'这条鱼透着光，很好看。',shareToUser:{text:'你看，我刚钓上来的。'}};let fail=false;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
await page.addInitScript(()=>{Math.random=()=>0;});
await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='fishing-model.invalid'){
        calls++;return route.fulfill({status:fail?503:200,contentType:'application/json',body:fail?JSON.stringify({error:{message:'QA simulated offline'}}):JSON.stringify({choices:[{message:{content:JSON.stringify(response)}}]})});
    }
    return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});
});
const state=()=>page.evaluate(()=>window.fishingFixture.readFishingMarketState());
const waitDone=async()=>{await page.waitForFunction(()=>!document.querySelector('.fishing-shell')?.textContent.includes('活动进行中'));await page.waitForTimeout(350);};
const choose=async id=>{if(!await page.getByLabel('选择去水域的角色').isVisible())await page.getByText('角色钓鱼',{exact:true}).click();await page.getByLabel('选择去水域的角色').selectOption(id);};
const trip=async()=>{await page.getByRole('button',{name:'让 ta 去钓鱼',exact:true}).click();await waitDone();};
try{
    await page.goto(`${base}/test/fixtures/fishing-characters.html`,{waitUntil:'domcontentloaded',timeout:60000});
    await choose('fish-a');await trip();assert.equal(calls,1);
    let s=await state();assert.equal(s.fishingTrips.length,1);assert.equal(s.fishingTrips[0].shareSent,true);assert.equal(s.inventory[0].ownerId,'fish-a');
    let board=await page.evaluate(()=>window.fishingFixture.DB.getVRGuestbook());assert.equal(board.messages.length,1);assert.equal(board.messages[0].kind,'collection-unlock');
    assert.equal(await page.evaluate(async()=> (await window.fishingFixture.DB.getMessagesByCharId('fish-a',true)).filter(m=>m.type==='text').length),1);
    await page.screenshot({path:out+'/keep-share-390.png'});
    await page.getByRole('button',{name:'查看 ta 的收藏与图鉴 →'}).click();await page.getByText('阿岚 的水域图鉴',{exact:true}).waitFor();await page.screenshot({path:out+'/personal-catalog-390.png'});
    await page.getByLabel('查看谁的钱包和收藏').selectOption('fish-b');assert.equal(await page.getByText('累计获得 1 件 · 现有 1 件',{exact:true}).count(),0);
    await page.getByRole('button',{name:'钓鱼',exact:true}).click();await choose('fish-b');response={disposition:'release',reaction:'还小，放回水里吧。',shareToUser:{text:'我放回去了。今天算陪它散步。'}};
    await trip();s=await state();assert.equal(calls,2);assert.equal(s.inventory.filter(c=>c.ownerId==='fish-b').length,0);assert.equal(s.collectionEntries.filter(e=>e.actorId==='fish-b').length,1);
    board=await page.evaluate(()=>window.fishingFixture.DB.getVRGuestbook());assert.equal(board.messages.length,2);
    await page.screenshot({path:out+'/release-share-390.png'});await trip();assert.equal((await page.evaluate(()=>window.fishingFixture.DB.getVRGuestbook())).messages.length,2);
    await choose('fish-a');fail=true;await trip();s=await state();const pendingId=s.fishingTrips.find(t=>t.status==='pending').catch.id;const count=s.fishingTrips.length;
    await page.getByRole('button',{name:'继续处理这一竿',exact:true}).waitFor();await page.screenshot({path:out+'/pending-390.png'});
    fail=false;response={disposition:'keep',reaction:'留下了。',shareToUser:null};await page.getByRole('button',{name:'继续处理这一竿',exact:true}).click();await waitDone();s=await state();assert.equal(s.fishingTrips.length,count);assert.equal(s.fishingTrips.find(t=>t.catch.id===pendingId).status,'settled');
    await page.evaluate(()=>{const f=window.fishingFixture;f.originalSave=f.DB.saveMessageOnce;f.DB.saveMessageOnce=async(key,...args)=>{if(key.startsWith('fishing_share_'))throw Error('QA delivery failure');return f.originalSave(key,...args);};});
    response={disposition:'keep',reaction:'想给你看看。',shareToUser:{text:'这是刚才那一条。'}};await trip();const beforeRetry=calls;await page.getByRole('button',{name:'重试发送记录与分享'}).waitFor();
    await page.evaluate(()=>{window.fishingFixture.DB.saveMessageOnce=window.fishingFixture.originalSave;});await page.getByRole('button',{name:'重试发送记录与分享'}).click();await page.waitForFunction(()=>window.fishingFixture.readFishingMarketState().fishingTrips.at(-1).shareSent);assert.equal(calls,beforeRetry);
    await page.getByRole('button',{name:'查看 ta 的收藏与图鉴 →'}).click();await page.setViewportSize({width:320,height:740});await page.screenshot({path:out+'/personal-catalog-320.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
    await page.getByText('累计获得 3 件 · 现有 3 件',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.screenshot({path:out+'/catalog-stats-320.png'});
    const final=await state();assert.equal(final.fishingTrips.length,5);assert.equal(final.collectionEntries.length,2);assert.equal(calls,6);
    // Real public-room renderer sees the same persisted announcements.
    await page.goto(`${base}/test/fixtures/kanata.html`,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByText('留言簿',{exact:true}).click({timeout:60000});await page.getByText('留言墙',{exact:true}).waitFor();await page.getByText('图鉴解锁',{exact:true}).first().waitFor();await page.screenshot({path:out+'/public-announcements-320.png'});
    await fs.writeFile(out+'/report.json',JSON.stringify({calls,tripCount:final.fishingTrips.length,personalSpecies:final.collectionEntries.length,announcements:board.messages.length,errors},null,2));
    assert.deepEqual(errors,[]);console.log('Real UI/DB: keep/release + DM, per-character catalog, once-only unlocks, failed-call retry, delivery-only retry and 320px layout passed.');
}finally{await page.screenshot({path:out+'/last.png'}).catch(()=>{});await fs.writeFile(out+'/errors.json',JSON.stringify(errors,null,2));await fs.writeFile(out+'/console-errors.json',JSON.stringify(consoleErrors,null,2));await browser.close();}
