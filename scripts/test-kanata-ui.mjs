import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='output/fishing-qa/kanata';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];const requests=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
    const req=route.request();const url=new URL(req.url());
    if(url.pathname.includes('/poem/')){
        requests.push({url:req.url(),method:req.method()});
        const data=url.pathname.endsWith('/current')?{ok:true,ended:true,paused:true,booklet:{id:'archive',title:'信号坠落处',subtitle:'低电量合唱',poemsTarget:40,poemCount:0,linesMin:4,linesMax:12,charsPerLine:24,status:'done'},poem:null,recent:[]}:{ok:true,poems:[]};
        return route.fulfill({json:data});
    }
    // No model, mail or account requests leave this isolated test context.
    if(url.hostname!=='127.0.0.1'&&url.hostname!=='localhost')return route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});
    return route.continue();
});
try{
    await page.goto((process.env.FISHING_QA_URL||'http://127.0.0.1:5177')+'/test/fixtures/kanata.html');
    await page.getByRole('button',{name:'下一页房间',exact:true}).waitFor();
    await page.screenshot({path:`${out}/01-world.png`});
    const forward=page.getByRole('button',{name:'SAR',exact:true});await forward.click();
    const waterEntry=page.getByRole('button',{name:'进入水域',exact:true});
    const boardEntry=page.getByRole('button',{name:'进入布告板',exact:true});
    assert.equal(await waterEntry.count(),1);assert.equal(await boardEntry.count(),1);
    await page.waitForFunction(() => {
        const art = document.querySelector('img[alt="SAR 活动室"]');
        return art instanceof HTMLImageElement && art.complete && art.naturalWidth > 0;
    });
    assert.equal(await page.locator('.sar-world-page canvas').count(),0);
    await page.screenshot({path:`${out}/01b-sar-entries.png`});
    await waterEntry.click();await page.getByRole('button',{name:'抛竿',exact:true}).waitFor();
    await page.screenshot({path:`${out}/02-water.png`});
    assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'tide-resonance-fishing');
    assert.equal(await page.getByRole('dialog',{name:'彼方水域',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'让 ta 逛布告板',exact:true}).count(),0);
    // An isolated catch fixture verifies that the two entrances share the same persisted world.
    const shared=await page.evaluate(async()=>{
        const m=await import('/utils/vrWorld/fishingMarket.ts');const user={id:'user',name:'钓鱼测试员',kind:'user'};
        const s=await m.mutateFishingMarket(s=>m.addCatchToState(s,m.rollFishingCatch(user,{kind:'clear',label:'晴',source:'simulated',detail:'测试天气'})));
        return {seed:s.seed,accounts:s.accounts,inventory:s.inventory,prices:s.prices};
    });
    const readShared=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vr_fishing_market_v1'));return {seed:s.seed,accounts:s.accounts,inventory:s.inventory,prices:s.prices};});
    await page.getByRole('button',{name:'离开水域',exact:true}).click();await boardEntry.click();
    await page.getByRole('dialog',{name:'彼方布告板',exact:true}).waitFor();
    await page.getByRole('button',{name:'写便笺',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'抛竿',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'图鉴',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'让 ta 去钓鱼',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'让 ta 逛布告板',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).tab),'board');
    assert.deepEqual(await readShared(),shared);
    await page.screenshot({path:`${out}/02b-board.png`});
    await page.getByRole('button',{name:'离开布告板',exact:true}).click();
    await page.setViewportSize({width:320,height:740});
    await page.screenshot({path:`${out}/02c-small-entries.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await boardEntry.click();await page.getByRole('button',{name:'写便笺',exact:true}).waitFor();
    await page.screenshot({path:`${out}/02d-small-board.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'离开布告板',exact:true}).click();await waterEntry.click();
    await page.getByRole('button',{name:'抛竿',exact:true}).waitFor();assert.deepEqual(await readShared(),shared);
    await page.getByRole('button',{name:'图鉴',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:/cm/}).count(),1);
    await page.getByRole('button',{name:'离开水域',exact:true}).click();
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'返回彼方',exact:true}).click();await page.getByRole('button',{name:'下一页房间',exact:true}).click();
    await page.getByRole('heading',{name:'往期活动',exact:true}).waitFor();await page.screenshot({path:`${out}/03-archives.png`});
    await page.getByRole('button',{name:/已封存 · 纪念馆/}).click();await page.getByText('落　幕',{exact:true}).waitFor();
    await page.screenshot({path:`${out}/04-memorial.png`});
    assert.equal(requests.some(r=>r.method!=='GET'),false);assert.deepEqual(errors,[]);writeFileSync(`${out}/result.json`,JSON.stringify({requests,errors},null,2));
    console.log('Kanata integration: separate water/board entrances, shared inventory/wallet/prices, mobile returns and read-only memorial passed.');
}finally{await browser.close();}
