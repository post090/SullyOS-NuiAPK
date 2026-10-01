import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/vr-activities',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5177/test/fixtures/kanata.html');
    const button=name=>page.getByRole('button',{name,exact:true});
    await button('接入').waitFor();
    await page.evaluate(async()=>{
        const {DB}=await import('/utils/db.ts');
        await DB.saveCharacter({id:'qa-activity',name:'活动测试',avatar:'',systemPrompt:'QA',vrState:{enabled:true,activityMode:'manual',intervalMinutes:120}});
        await DB.saveVRNovel({id:'qa-activity-book',title:'活动读物',segments:[{idx:0,text:'正文',chars:2}],totalChars:2,createdAt:1,updatedAt:1});
    });
    await page.reload();await button('接入').click();
    const card=page.locator('[data-vr-character="qa-activity"]');
    await card.waitFor();await card.locator('.vra-restrictions summary').click();
    await card.getByLabel('不自动玩抽芯片演绎',{exact:true}).check();
    await card.getByLabel('不自动去整个SAR活动室',{exact:true}).check();
    assert(await card.getByLabel('不自动玩模块商店',{exact:true}).isDisabled());
    await card.getByLabel('不自动去整个SAR活动室',{exact:true}).uncheck();
    assert(await card.getByLabel('不自动玩抽芯片演绎',{exact:true}).isChecked());
    assert(!(await card.getByLabel('不自动玩模块商店',{exact:true}).isChecked()));
    for(const room of ['图书馆','剧院','听歌房','留言簿','娱乐室','邮局'])await card.getByLabel(`不自动去${room}`,{exact:true}).check();
    await card.getByLabel('不自动去整个SAR活动室',{exact:true}).check();
    await card.getByRole('status').filter({hasText:'全部自动活动已排除'}).waitFor();
    await page.screenshot({path:'output/vr-activities/03-restrictions.png'});
    const saved=await page.evaluate(async()=>{const{DB}=await import('/utils/db.ts');return(await DB.getAllCharacters()).find(c=>c.id==='qa-activity').vrState;});
    assert.equal(saved.excludedAutoRooms.length,7);assert.deepEqual(saved.excludedAutoSARActivities,['cabinet']);
    await page.reload();await button('接入').click();await card.locator('.vra-restrictions summary').click();
    assert(await card.getByLabel('不自动去整个SAR活动室',{exact:true}).isChecked());
    // Capture UI routing without calling a model. Scheduler forwarding is separately unit-tested.
    await page.evaluate(()=>{window.activityCalls=[];window.kanataQA.scheduler.triggerNow=(...args)=>window.activityCalls.push(args);});
    const open=()=>card.getByRole('button',{name:'让 ta 现在去逛一次',exact:true}).click();
    await open();const modal=page.getByRole('dialog',{name:'邀请活动测试活动'});
    await modal.waitFor();await page.screenshot({path:'output/vr-activities/01-groups.png'});
    assert.equal(await modal.locator('main > button').count(),2);
    await modal.getByRole('button',{name:/^普通空间/}).click();
    assert.equal(await modal.locator('main > button').count(),6);
    await button('返回活动分类').click();await modal.getByRole('button',{name:/^SAR 活动室/}).click();
    assert.equal(await modal.locator('main > button').count(),5);
    assert(await modal.getByRole('button',{name:/^恐龙箱庭/}).isDisabled());
    await page.keyboard.press('Escape');assert.equal(await modal.locator('main > button').count(),2);
    await button('关闭活动选择').click();
    await page.evaluate(async()=>{
        const{readFishingMarketState,saveFishingMarketState}=await import('/utils/vrWorld/fishingMarket.ts');
        const{ensureDinosaurGarden,setGardenVisits}=await import('/utils/vrWorld/dinosaurGarden.ts');
        const user={id:'user',name:'测试用户',kind:'user'};
        saveFishingMarketState(setGardenVisits(ensureDinosaurGarden(readFishingMarketState(),user),true,user));
    });
    const activities=[['抽芯片演绎','cabinet'],['模块商店','module-shop'],['水域钓鱼','fishing'],['布告板','market'],['恐龙箱庭','garden']];
    for(const [label,id] of activities){await open();await modal.getByRole('button',{name:/^SAR 活动室/}).click();await modal.getByRole('button',{name:new RegExp('^'+label)}).click();assert.deepEqual((await page.evaluate(()=>window.activityCalls)).at(-1),['qa-activity','sar',undefined,id]);await modal.waitFor({state:'detached'});}
    // Manual ordinary invitations also remain enabled despite automatic exclusion.
    await open();await modal.getByRole('button',{name:/^普通空间/}).click();await modal.getByRole('button',{name:/^图书馆/}).click();assert.deepEqual((await page.evaluate(()=>window.activityCalls)).at(-1),['qa-activity','library',undefined,undefined]);
    for(const [width,height,top] of [[390,844,83],[320,568,59],[844,390,24]]){
        await page.setViewportSize({width,height});await page.evaluate(top=>{document.documentElement.style.setProperty('--chrome-top',`${top}px`);document.documentElement.style.setProperty('--safe-bottom','34px');},top);
        await open();await modal.getByRole('button',{name:/^SAR 活动室/}).click();
        const back=await button('返回活动分类').boundingBox(),random=await button('在活动室随便玩一样').boundingBox();assert(back.y>=top);assert(random.y+random.height<=height-34);
        await page.screenshot({path:`output/vr-activities/02-sar-${width}.png`});
        await button('返回活动分类').click();await button('关闭活动选择').click();
    }
    const backup=await page.evaluate(async()=>{const{DB}=await import('/utils/db.ts');return(await DB.exportFullData()).characters.find(c=>c.id==='qa-activity').vrState;});assert.deepEqual(backup.excludedAutoRooms,saved.excludedAutoRooms);
    await card.getByRole('button',{name:'恢复全部可去',exact:true}).click();
    await page.waitForFunction(async()=>{const{DB}=await import('/utils/db.ts');const c=(await DB.getAllCharacters()).find(c=>c.id==='qa-activity');return !c.vrState.excludedAutoRooms.length&&!c.vrState.excludedAutoSARActivities.length;});
    // Exercise the real UI -> scheduler -> OSContext -> runSession chain with a local fake model.
    let modelMode='module-shop';const requests=[];
    await page.route('**/qa-activity-api/**',async route=>{
        requests.push(JSON.parse(route.request().postData()));
        const content=modelMode==='module-shop'?'<ACTIVITY>研究了模块。</ACTIVITY><NOTE>这次只看不买。</NOTE><BUY>NO</BUY><USE_ON_USER>NO</USE_ON_USER>':JSON.stringify({title:'手动芯片检查',story:'芯片只用来演绎这一场。',notes:'记下了这次推演。'});
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{role:'assistant',content}}]})});
    });
    await page.evaluate(async()=>{
        const{DB}=await import('/utils/db.ts');const c=(await DB.getAllCharacters()).find(c=>c.id==='qa-activity');
        await DB.saveCharacter({...c,memoryPalaceEnabled:false,vrState:{...c.vrState,excludedAutoRooms:['sar'],api:{baseUrl:'http://127.0.0.1:5177/qa-activity-api/v1',apiKey:'qa-local',model:'qa'}}});
    });
    await page.reload();await button('接入').click();
    for(const [label,mode,meta] of [['模块商店','module-shop','sarModuleShop'],['抽芯片演绎','cabinet','sarCabinetNote']]){
        modelMode=mode;await open();await modal.getByRole('button',{name:/^SAR 活动室/}).click();await modal.getByRole('button',{name:new RegExp('^'+label)}).click();
        await page.waitForFunction(async meta=>{const{DB}=await import('/utils/db.ts');return(await DB.getVRCardsByCharId('qa-activity')).some(m=>m.metadata?.[meta]);},meta);
    }
    assert.equal(requests.length,2);assert(requests[0].messages.some(m=>typeof m.content==='string'&&m.content.includes('此刻只在模块商店')));
    assert.deepEqual(errors,[]);console.log('PASS two-level menu, all five SAR routes, ordinary invitation, unavailable garden, exclusions persistence/inheritance/reset/backup, keyboard return, portrait/landscape safe areas.');
}finally{await browser.close();}
