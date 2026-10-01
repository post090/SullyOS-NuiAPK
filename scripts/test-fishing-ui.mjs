import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out='output/fishing-qa/mobile';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
const screenshot=async name=>{await page.screenshot({path:`${out}/${name}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');};
try{
    await page.goto((process.env.FISHING_QA_URL||'http://127.0.0.1:5177')+'/test/fixtures/fishing.html');
    await page.getByRole('button',{name:'抛竿',exact:true}).waitFor();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.fishing-shell')).position==='fixed');
    await screenshot('01-water');
    await page.getByRole('button',{name:'抛竿',exact:true}).click();await page.evaluate(()=>window.advanceTime(0));
    for(let i=0;i<320;i++){
        const s=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
        if(s.phase==='caught'||s.phase==='escaped')break;
        const delta=Math.atan2(Math.sin(s.fishAngle-s.playerAngle-s.playerVelocity*.1),Math.cos(s.fishAngle-s.playerAngle-s.playerVelocity*.1));
        if(delta>0)await page.keyboard.down('Space');else await page.keyboard.up('Space');
        await page.evaluate(()=>window.advanceTime(90));
    }
    await page.keyboard.up('Space');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).inventory.length===1);
    assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).phase),'caught');await screenshot('02-caught');
    await page.getByRole('button',{name:'再钓一次',exact:true}).click();await page.getByRole('button',{name:'收竿',exact:true}).click();assert.equal((await read()).inventory.length,1);
    await page.getByRole('button',{name:'再钓一次',exact:true}).click();await page.evaluate(()=>window.advanceTime(35000));assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).phase),'escaped');assert.equal((await read()).inventory.length,1);await screenshot('03-escaped');
    await page.keyboard.press('f');await page.waitForFunction(()=>!!document.fullscreenElement);await page.keyboard.press('f');await page.waitForFunction(()=>!document.fullscreenElement);
    await page.getByRole('button',{name:'图鉴',exact:true}).click();await screenshot('04-catalog');
    await page.getByRole('button',{name:/cm/}).first().click();await page.getByRole('button',{name:'自己定价挂板',exact:true}).click();
    await page.getByLabel('金额',{exact:true}).fill('0');await page.getByLabel('便笺正文').fill('你们到底想干嘛！！');await page.getByLabel('匿名笔名').fill('神秘交易员');await page.getByRole('button',{name:'贴上布告板',exact:true}).click();
    await page.getByRole('dialog',{name:'彼方布告板',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'图鉴',exact:true}).count(),0);
    await page.getByRole('button',{name:/出售 ·/}).first().click();await page.getByLabel('回复或交付内容').fill('？？？');await page.getByRole('button',{name:'回复',exact:true}).click();
    await screenshot('05-listing-comments');await page.getByRole('button',{name:'撤下并存档',exact:true}).click();await page.getByRole('button',{name:'关闭详情'}).click();
    await page.getByRole('button',{name:'档案',exact:true}).click();assert.equal((await read()).listings[0].status,'removed');await screenshot('06-archive');
    // Fixtures exercise UI payment paths without model calls or user data.
    await page.evaluate(async()=>{
        const m=await import('/utils/vrWorld/fishingMarket.ts');const seller={id:'wanderer:qa',name:'测试路人',kind:'wanderer'};
        await m.mutateFishingMarket(s=>m.createListing(m.ensureActorAccounts(s,[seller]),seller,null,0,'今日空气免费',Date.now(),'一口空气'));
        await m.mutateFishingMarket(s=>m.createRequest(s,seller,undefined,'给我钱',30,'居然真有人给钱吗',Date.now(),'tip'));
    });
    await page.getByRole('button',{name:'布告板',exact:true}).click();await page.getByRole('button',{name:'挂板出售',exact:true}).click();await page.getByRole('button',{name:/出售 · 一口空气/}).click();await page.getByRole('button',{name:'买下',exact:true}).click();await page.getByRole('button',{name:'关闭详情'}).click();
    await page.getByRole('button',{name:'需求区',exact:true}).click();await page.getByRole('button',{name:/求打赏 · 给我钱/}).click();await page.getByRole('button',{name:'给 ta 鳞币',exact:true}).click();assert.equal((await read()).accounts.user,970);await screenshot('07-tip-paid');await page.getByRole('button',{name:'关闭详情'}).click();
    await page.reload();await page.getByRole('button',{name:'抛竿',exact:true}).waitFor();assert.equal((await read()).accounts.user,970);
    await page.evaluate(async()=>{const m=await import('/utils/vrWorld/fishingMarket.ts');await m.mutateFishingMarket(s=>({...s,discovered:m.FISH_CATALOG.map(f=>f.id)}));});
    await page.getByRole('button',{name:'图鉴',exact:true}).click();await page.getByRole('heading',{name:'水域图鉴'}).scrollIntoViewIfNeeded();await screenshot('08-fish-art');
    await page.setViewportSize({width:320,height:740});await screenshot('09-small-screen');
    const saved=await read();
    await page.goto((process.env.FISHING_QA_URL||'http://127.0.0.1:5177')+'/test/fixtures/fishing.html?entry=board');
    await page.getByRole('button',{name:'鱼类行情',exact:true}).waitFor();
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).boardTab==='prices');
    assert.equal((await read()).accounts.user,970);assert.deepEqual((await read()).inventory,saved.inventory);
    assert.equal(await page.getByRole('button',{name:'抛竿',exact:true}).count(),0);await screenshot('10-board-direct');
    writeFileSync(`${out}/result.json`,JSON.stringify({errors,state:await read()},null,2));assert.deepEqual(errors,[]);console.log('Fishing mobile UI: catch/cancel/escape/fullscreen/catalog/list/comment/archive/buy/tip/persistence passed.');
}finally{await browser.close();}
