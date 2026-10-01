import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='output/fishing-qa/sar-hub';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('[VRWorld]'))console.log(message.text());});
let modelReply='', modelCalls=0;
await context.route('**/*',route=>{const url=new URL(route.request().url());
    if(url.pathname==='/sar-hub-model/chat/completions'){modelCalls++;return route.fulfill({json:{choices:[{message:{content:modelReply}}]}});}
    return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});
});
const button=name=>page.getByRole('button',{name,exact:true});
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
const enter=async()=>{await button('SAR').click();await page.waitForFunction(()=>{const img=document.querySelector('img[alt="SAR 活动室"]');return img?.complete&&img?.naturalWidth>0&&document.querySelector('.sar-room-canvas')?.clientWidth>0;});};
try{
    await page.goto('http://127.0.0.1:5177/test/fixtures/kanata.html?npcs=show');
    await button('下一页房间').waitFor();
    await page.evaluate(async()=>{
        const {DB}=await import('/utils/db.ts');const m=await import('/utils/vrWorld/fishingMarket.ts');const shop=await import('/utils/vrWorld/sarModuleShop.ts');
        for(const [id,name] of [['hub-aran','阿岚'],['hub-nora','诺拉']]) await DB.saveCharacter({id,name,avatar:'',systemPrompt:'本地界面测试',vrState:{enabled:true,activityMode:'manual',intervalMinutes:120,currentRoom:'sar'}});
        const fish=(id,ownerId,speciesId)=>({id,ownerId,ownerName:ownerId==='user'?'我':'阿岚',speciesId,caughtAt:Date.now(),weather:'clear',weatherLabel:'晴朗',weatherSource:'simulated',sizeCm:23.4,quality:2});
        let s=m.ensureMarketDay({...m.createFishingMarketState(42),accounts:{user:120,'hub-aran':76,'hub-nora':0},inventory:[fish('user-fish','user','cloud-carp'),fish('user-dino','user','triceratops'),fish('char-fish','hub-aran','rain-drum')]});
        const moduleShop=shop.createSARModuleShopState(new Date(),()=>.2);moduleShop.inventory={[shop.SAR_MODULE_CATALOG[0].id]:2,[shop.SAR_MODULE_CATALOG[4].id]:1};
        s.sarCommerce={moduleShop,gacha:{version:1,collection:{'story-01':1,'variant-01':2,'variant-02':1},history:[],freeDrawDate:{}}};
        s.sarCharacterModules={'hub-aran':{[shop.SAR_MODULE_CATALOG[3].id]:1}};
        m.saveFishingMarketState(s);
    });
    await page.reload();await button('SAR').waitFor();await page.screenshot({path:`${out}/00-entry.png`,clip:{x:0,y:0,width:390,height:108},animations:'disabled'});await enter();
    assert.equal(await page.locator('.vr-sar-light').count(),1);
    assert.equal(await page.locator('.vr-tabs').count(),0);assert.equal(await page.locator('.vr-topbar').count(),0);assert.equal(await page.locator('.sar-world-pagination').count(),0);
    assert.equal((await page.evaluate(()=>JSON.parse(window.render_game_to_text()))).tab,'sar');
    assert((await page.locator('.sar-world-page').boundingBox()).height>=840);
    assert.equal(await button('与凯恩交谈').count(),1);assert.equal(await button('与艾文交谈').count(),1);
    const tools=await page.locator('.sar-hub-tools').boundingBox();assert(tools.x>150&&tools.width>=135&&tools.x+tools.width<=390);
    await shot('01-room');
    await button('活动室设置').click();await page.getByRole('dialog',{name:'活动室设置'}).waitFor();
    await shot('02-settings');const toggle=page.getByRole('switch',{name:'显示常驻 NPC'});
    await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'false');await button('返回活动室').click();
    assert.equal(await button('与凯恩交谈').count(),0);assert.equal(await button('与艾文交谈').count(),0);assert.equal(await button('进入水域').count(),1);
    await page.reload();await enter();assert.equal(await button('与凯恩交谈').count(),0);
    await button('活动室设置').click();await page.getByRole('switch',{name:'显示常驻 NPC'}).click();await button('返回活动室').click();assert.equal(await button('与凯恩交谈').count(),1);
    await button('打开仓库').click();await page.getByTestId('sar-wallet-balance').waitFor();
    assert.equal(await page.getByTestId('sar-wallet-balance').innerText(),'120');assert.equal(await page.locator('.sar-hub-item').count(),7);
    await shot('03-user-warehouse');
    await page.locator('.sar-hub-item').first().click();await page.locator('.sar-hub-item-detail').waitFor();await shot('04-item');
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'随身仓库'}).count(),1);assert.equal(await page.locator('.sar-hub-item-detail').count(),0);
    await page.getByRole('combobox',{name:'仓库主人'}).selectOption('hub-aran');assert.equal(await page.getByTestId('sar-wallet-balance').innerText(),'76');assert.equal(await page.locator('.sar-hub-item').count(),2);
    assert((await page.locator('.sar-hub-items').innerText()).includes('雨鼓鱼'));assert(!(await page.locator('.sar-hub-items').innerText()).includes('云纹鲤'));await shot('05-character-warehouse');
    await page.getByRole('combobox',{name:'仓库主人'}).selectOption('hub-nora');assert.equal(await page.getByTestId('sar-wallet-balance').innerText(),'0');await shot('06-empty');
    // An update from another tab refreshes the selected owner's actual balance and bag.
    const other=await context.newPage();await other.goto('http://127.0.0.1:5177/test/fixtures/kanata.html');
    await other.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vr_fishing_market_v1'));s.accounts['hub-nora']=37;localStorage.setItem('vr_fishing_market_v1',JSON.stringify(s));});
    await page.waitForFunction(()=>document.querySelector('[data-testid="sar-wallet-balance"]')?.textContent==='37');await other.close();
    await page.getByRole('combobox',{name:'仓库主人'}).selectOption('user');await button('模块').click();assert.equal(await page.locator('.sar-hub-item').count(),2);
    await page.setViewportSize({width:320,height:680});await button('全部').click();await shot('07-small-warehouse');
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'随身仓库'}).count(),0);assert.equal(await button('打开仓库').evaluate(el=>el===document.activeElement),true);await shot('08-small-room');
    for(const name of ['进入水域','进入布告板','活动室设置','打开仓库']) {const box=await button(name).boundingBox();assert(box.y>=0&&box.y+box.height<=680,`${name} outside viewport`);}
    await page.setViewportSize({width:1100,height:850});await shot('09-desktop-room');await button('打开仓库').click();await page.getByTestId('sar-wallet-balance').waitFor();await shot('10-desktop-warehouse');
    // Focus must stay in the panel; closing restores the entrance.
    await button('返回活动室').focus();await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.querySelector('.sar-hub-panel').contains(document.activeElement)));
    await page.keyboard.press('Escape');await button('返回彼方').click();assert.equal(await page.locator('.vr-sar-light').count(),0);
    await button('下一页房间').click();await page.getByRole('heading',{name:'往期活动',exact:true}).waitFor();await button('返回世界房间').click();
    await page.setViewportSize({width:320,height:680});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await button('SAR').count(),1);
    const visit=async(balance,permission=false)=>page.evaluate(async({balance,permission})=>{
        const {DB}=await import('/utils/db.ts');const {runVRSession}=await import('/utils/vrWorld/runSession.ts');const m=await import('/utils/vrWorld/fishingMarket.ts');
        const char={id:'hub-shop',name:'逛店的阿岚',avatar:'',systemPrompt:'中文回复，自己决定。',contextLimit:20,memoryPalaceEnabled:false,vrState:{enabled:true,activityMode:'manual',intervalMinutes:120,currentRoom:'sar'}};
        await DB.saveCharacter(char);if(balance!==null)await m.mutateFishingMarket(s=>({...s,accounts:{...s.accounts,[char.id]:balance},sarCharacterModules:{...s.sarCharacterModules,[char.id]:{}}}));
        let user={name:'我',vrState:{enabled:true,currentRoom:'sar',allowCharacterModules:permission}};
        const original=Math.random;Math.random=()=>.705; // Real random activity selection enters the module shop.
        try{const result=await runVRSession({char,characters:[char],userProfile:user,groups:[],apiConfig:{baseUrl:'http://127.0.0.1:5177/sar-hub-model',model:'fixture',apiKey:'fixture'},forcedRoom:'sar',manual:true,
            updateCharacter:async(id,patch)=>{const current=(await DB.getAllCharacters()).find(c=>c.id===id);await DB.saveCharacter({...current,...(typeof patch==='function'?patch(current):patch)});},
            updateUserProfile:patch=>{user={...user,...(typeof patch==='function'?patch(user):patch)};}});
            const state=m.readFishingMarketState();return {result,user,state};
        }finally{Math.random=original;}
    },{balance,permission});
    modelReply='<ACTIVITY>他在展示台前停了一会儿。</ACTIVITY><NOTE>今天先看看。</NOTE><BUY>NO</BUY><USE_ON_USER>NO</USE_ON_USER>';
    let trip=await visit(120);assert.equal(trip.result.ok,true,JSON.stringify(trip.result));assert.equal(trip.state.accounts['hub-shop'],120);assert.deepEqual(trip.state.sarCharacterModules['hub-shop'],{});
    modelReply='<ACTIVITY>他挑中一枚模块。</ACTIVITY><NOTE>放在我的仓库里，改天再试。</NOTE><BUY>YES</BUY><USE_ON_USER>NO</USE_ON_USER>';
    trip=await visit(null);assert.equal(trip.result.ok,true,JSON.stringify(trip.result));const paid=120-trip.state.accounts['hub-shop'];assert(paid>=18&&paid<=34);assert.equal(Object.values(trip.state.sarCharacterModules['hub-shop']).reduce((a,b)=>a+b,0),1);
    const balanceAfter=trip.state.accounts['hub-shop'];
    modelReply='<ACTIVITY>他把自己的模块装在你身上。</ACTIVITY><NOTE>正好你也在，我想试试。</NOTE><BUY>YES</BUY><USE_ON_USER>YES</USE_ON_USER>';
    trip=await visit(null,true);assert.equal(trip.result.ok,true,JSON.stringify(trip.result));assert.equal(trip.state.accounts['hub-shop'],balanceAfter);assert.equal(Object.values(trip.state.sarCharacterModules['hub-shop']).reduce((a,b)=>a+b,0),0);assert.equal(trip.user.vrState.sarModule.sourceCharacterId,'hub-shop');
    trip=await visit(30,true);assert.equal(trip.result.ok,true,JSON.stringify(trip.result));assert.equal(trip.state.accounts['hub-shop'],30);assert(!trip.user.vrState.sarModule);assert(trip.result.activity.includes('没有购买'));
    assert.equal(trip.state.accounts.user,120);assert.equal(modelCalls,4);
    // Sample catch valuations, not a claim about player completion time or successful catch rate.
    const economySample=await page.evaluate(async()=>{
        const m=await import('/utils/vrWorld/fishingMarket.ts');const result={};
        for(const kind of Object.keys(m.WEATHER_LABELS)){
            const random=m.marketRandom(417),state=m.ensureMarketDay(m.createFishingMarketState(42));const values=[];
            for(let i=0;i<10000;i++)values.push(m.catchValue(state,m.rollFishingCatch({id:'user',name:'我'},{kind,label:'',detail:'',source:'simulated'},random)));
            values.sort((a,b)=>a-b);result[kind]={mean:Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)),median:values[5000],max:values.at(-1)};
        }return result;
    });
    assert.deepEqual(errors,[]);writeFileSync(`${out}/result.json`,JSON.stringify({passed:true,errors,modelCalls,economySample},null,2));
    console.log('SAR hub: light shell, persisted NPC setting, independent wallets/bags, filters, cross-tab refresh, empty state, keyboard, 320/390/1100 px passed.');
}finally{await browser.close();}
