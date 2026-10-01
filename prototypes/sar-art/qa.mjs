import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='output/sar-art-qa';await fs.mkdir(out,{recursive:true});
const base=process.env.SAR_ART_QA_URL||'http://127.0.0.1:5177';
const browser=await chromium.launch({headless:true,channel:process.env.FISHING_BROWSER_CHANNEL||'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
    const url=new URL(route.request().url()),art=url.pathname.match(/SAR\/(Caian|Aiven)\/([^/]+)\.png$/);
    // Production prefers the local WebP pack. Any CDN fallback stays within this isolated test.
    if(url.pathname.startsWith('/sar-portraits/'))requests.push(url.href);
    if(art){requests.push(url.href);return route.fulfill({status:200,contentType:'image/webp',body:await fs.readFile(`public/sar-portraits/${art[1]}/${art[2]}.webp`)});}
    return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});
});
const imageReady=async(who,expression)=>{
    const expected=who?{who,expression}:await page.evaluate(()=>{const face=document.querySelector('.is-speaking .sar-npc-portrait')||document.querySelector('.sar-npc-portrait');return {who:face?.dataset.speaker,expression:face?.dataset.expression};});
    await page.waitForFunction(({who,expression})=>{const box=document.querySelector(`.sar-npc-portrait[data-speaker="${who}"]`);const img=box?.querySelector('img:not(.sar-npc-portrait__pending)');return box?.dataset.expression===expression&&box.getAttribute('aria-busy')==='false'&&img?.complete&&img.naturalWidth>100;},expected);
};
// Text must not move the stage/panel. Actor geometry may change when someone joins or leaves.
const frameGeometry=()=>page.evaluate(()=>['.sar-dialogue-portraits','.sar-dialogue-panel'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
const visibleCast=()=>page.evaluate(()=>[...document.querySelectorAll('.sar-dialogue-cast__actor')].filter(el=>el.getBoundingClientRect().width>0&&getComputedStyle(el).visibility!=='hidden').map(el=>el.querySelector('.sar-npc-portrait')?.dataset.speaker));
async function checkCast(people){assert.deepEqual(await visibleCast(),people);await checkHeadroom();}
async function checkHeadroom(){
    const gaps=await page.evaluate(()=>{const top=document.querySelector('.sar-dialogue-portraits').getBoundingClientRect().top;return [...document.querySelectorAll('.sar-dialogue-cast__actor')].filter(el=>el.getBoundingClientRect().width>0&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect().top-top);});
    assert.ok(gaps.length>0&&gaps.every(gap=>Math.abs(gap-24)<.1),'Every visible portrait keeps 24px headroom at the approved layout.');
}
async function untilChoice(label){
    const initial=await frameGeometry();
    for(let i=0;i<55;i++){
        assert.deepEqual(await frameGeometry(),initial,'Dialogue text and choices must not move the stage or resize the dialogue box.');
        if(await page.getByRole('button',{name:label,exact:true}).count()){
            await page.waitForTimeout(220);
            const floating=await page.locator('.sar-dialogue-choices__list').evaluate(el=>{const r=el.getBoundingClientRect(),stage=el.closest('.sar-npc-dialogue').getBoundingClientRect();return {insideDialogue:!!el.closest('.sar-dialogue-panel'),dx:Math.abs(r.x+r.width/2-stage.x-stage.width/2),dy:Math.abs(r.y+r.height/2-stage.y-stage.height/2)};});
            assert.equal(floating.insideDialogue,false);assert.ok(floating.dx<1&&floating.dy<1);return;
        }
        await page.getByRole('button',{name:'继续对话',exact:true}).click();
    }
    throw Error('Missing dialogue choice: '+label);
}
async function inspectPlacement(){
    const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.ok(state.actors.every(a=>a.valid));assert.equal(state.facilities.length,6);
    const alignment=await page.evaluate(()=>{
        const canvas=document.querySelector('.sar-room-canvas').getBoundingClientRect();return [...document.querySelectorAll('[data-actor-id]')].map(el=>{
            const rect=el.getBoundingClientRect();return {dx:Math.abs((rect.x+rect.width/2-canvas.x)/canvas.width*1348-Number(el.dataset.footX)),dy:Math.abs((rect.bottom-canvas.y)/canvas.height*2439-Number(el.dataset.footY))};
        });
    });assert.ok(alignment.every(p=>p.dx<1&&p.dy<1));
}
try{
    await page.goto(`${base}/prototypes/sar-art/index.html`,{waitUntil:'domcontentloaded'});await page.locator('[data-actor-id]').first().waitFor();await page.waitForTimeout(200);
    await inspectPlacement();assert.equal(requests.length,0);await page.screenshot({path:`${out}/room-390.png`});
    for(const id of ['board','modules','cabinet','gacha','water','garden']){await page.locator(`[data-facility="${id}"]`).tap();assert.equal(await page.getByTestId('last-action').textContent(),id);}
    await page.getByRole('button',{name:'与凯恩交谈',exact:true}).tap();await imageReady('caian','happy');await checkCast(['caian']);await page.screenshot({path:`${out}/caian-happy-390.png`});
    await untilChoice('你谁啊');await page.screenshot({path:`${out}/centered-choices-390.png`});await page.getByRole('button',{name:'你谁啊',exact:true}).click();await untilChoice('SAR 是什么？');await page.getByRole('button',{name:'SAR 是什么？',exact:true}).click();
    for(let i=0;i<3;i++)await page.getByRole('button',{name:'继续对话',exact:true}).click();await imageReady('aiven','normal');await checkCast(['caian','aiven']);assert.equal(await page.locator('.is-speaking .sar-npc-portrait').getAttribute('data-speaker'),'aiven');await page.screenshot({path:`${out}/aiven-in-intro.png`});
    // The listening character reacts during Aiven's line, not one click later.
    for(let i=0;i<4;i++)await page.getByRole('button',{name:'继续对话',exact:true}).click();
    assert.equal(await page.locator('.sar-dialogue-panel p').textContent(),'这里似乎没有仿生人。');
    await imageReady('caian','embarrassed');await imageReady('aiven','normal');await checkCast(['caian','aiven']);
    assert.equal(await page.locator('.cast-caian.is-speaking').count(),0);await page.screenshot({path:`${out}/caian-listening-embarrassed.png`});
    await page.getByRole('button',{name:'继续对话',exact:true}).click();await imageReady('caian','embarrassed');await checkCast(['caian']);assert.equal(await page.locator('.cast-caian .sar-npc-portrait').getAttribute('data-expression'),'embarrassed');
    await untilChoice('仿生人是什么？');await page.getByRole('button',{name:'仿生人是什么？',exact:true}).click();await untilChoice('是什么样的仿生人？');await page.getByRole('button',{name:'是什么样的仿生人？',exact:true}).click();await imageReady();
    await imageReady('caian','aboutaster');await checkCast(['caian']);await page.screenshot({path:`${out}/caian-aboutaster-390.png`});
    const soloWidth=await page.locator('.cast-caian').evaluate(el=>el.getBoundingClientRect().width);
    await page.setViewportSize({width:600,height:844});await checkCast(['caian']);
    const soloGeometry=await page.evaluate(()=>({actor:document.querySelector('.cast-caian').getBoundingClientRect().width,stage:document.querySelector('.sar-dialogue-portraits').getBoundingClientRect().width}));
    assert.ok(soloGeometry.actor>soloWidth&&Math.abs(soloGeometry.actor-soloGeometry.stage)<.1,'A solo actor container follows the available stage width.');
    await page.setViewportSize({width:390,height:844});
    for(let i=0;i<8;i++)await page.getByRole('button',{name:'继续对话',exact:true}).click();
    await imageReady('aiven','sad');await imageReady('caian','embarrassed');await checkCast(['caian','aiven']);
    const exchangeWidths=await page.locator('.sar-dialogue-cast__actor').evaluateAll(actors=>actors.map(el=>el.getBoundingClientRect().width));
    await page.screenshot({path:`${out}/aiven-listening-sad-exchange.png`});
    await page.setViewportSize({width:600,height:844});await checkCast(['caian','aiven']);
    const resizedWidths=await page.locator('.sar-dialogue-cast__actor').evaluateAll(actors=>actors.map(el=>el.getBoundingClientRect().width));
    assert.ok(resizedWidths.every((width,i)=>Math.abs(width-exchangeWidths[i])<.1),'Exchange portraits remain sized by stage height when only its width changes.');
    await page.getByRole('button',{name:'继续对话',exact:true}).click();await imageReady('caian','embarrassed');await checkCast(['caian']);
    await page.setViewportSize({width:320,height:740});await checkHeadroom();await page.screenshot({path:`${out}/dialogue-320.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
    await page.setViewportSize({width:844,height:390});await checkHeadroom();await page.screenshot({path:`${out}/dialogue-landscape.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),844);
    await page.getByRole('button',{name:'暂时离开对话'}).click();await page.setViewportSize({width:320,height:740});await page.waitForTimeout(100);await inspectPlacement();await page.screenshot({path:`${out}/room-320.png`});
    for(const id of ['cabinet','gacha','garden']){await page.locator(`[data-facility="${id}"]`).tap();assert.equal(await page.getByTestId('last-action').textContent(),id);}
    await page.getByRole('button',{name:'与艾文交谈',exact:true}).tap();await imageReady('aiven','normal');await checkCast(['aiven']);await page.getByRole('button',{name:'聊聊恐龙',exact:true}).click();await imageReady('aiven','happy');await checkCast(['aiven']);await page.screenshot({path:`${out}/aiven-garden-320.png`});await page.getByRole('button',{name:'看看恐龙箱庭',exact:true}).click();assert.equal(await page.getByTestId('last-action').textContent(),'garden');
    await page.getByRole('button',{name:'NPC 显示',exact:true}).click();assert.equal(await page.locator('.sar-room-person.is-npc').count(),0);
    // Every supplied image is addressable without preloading the whole pack in the room.
    for(const who of ['caian','aiven']){
        await page.goto(`${base}/prototypes/sar-art/index.html?portrait=${who}`);await page.getByRole('button',{name:'normal',exact:true}).waitFor();const expressions=await page.getByRole('button').allTextContents();
        assert.equal(expressions.length,who==='caian'?7:6);
        for(const expression of expressions){await page.getByRole('button',{name:expression,exact:true}).click();await imageReady(who,expression);await page.screenshot({path:`${out}/${who}-${expression}.png`});}
    }
    // Complete provider-based entry: these are the same callbacks shipped in VRWorldApp.
    await page.setViewportSize({width:390,height:844});await page.goto(`${base}/test/fixtures/kanata.html?npcs=show`,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.vr-tabs')||document.querySelector('.sar-room-canvas'));
    if(await page.getByRole('button',{name:'SAR',exact:true}).count())await page.getByRole('button',{name:'SAR',exact:true}).click();
    await page.locator('.sar-room-person.is-npc').first().waitFor();await page.screenshot({path:`${out}/integrated-room.png`});
    // A deterministic quiet day exposes the permanent facility guide without editing authored progress.
    await page.evaluate(async()=>{const {visitFamiliarity}=await import('/utils/vrWorld/sarFamiliarity/state.ts');await visitFamiliarity('aiven',{userName:'我',random:()=>.99});});
    await page.getByRole('button',{name:'与艾文交谈',exact:true}).tap();await page.getByRole('button',{name:'聊聊钓鱼和恐龙',exact:true}).click();await imageReady('aiven','normal');await checkCast(['aiven']);await page.getByRole('button',{name:'聊聊恐龙',exact:true}).click();await page.getByRole('button',{name:'看看恐龙箱庭',exact:true}).click();await page.waitForSelector('.clay-app[data-ready="true"]',{timeout:60000});await page.getByRole('button',{name:'返回 SAR 活动室'}).click();
    await page.getByRole('button',{name:'与凯恩交谈',exact:true}).tap();await imageReady();await page.getByRole('button',{name:'暂时离开对话'}).click();
    await page.getByRole('button',{name:'进入模块购买'}).tap();await page.locator('.sar-module-shop__guide img').waitFor();await page.screenshot({path:`${out}/integrated-modules.png`});
    assert.deepEqual(errors,[]);console.log('SAR artwork, 13 local expressions, solo → actual exchange → solo, responsive geometry, six hotspots, NPC toggles and integrated dialogue → garden verified.');
}finally{await fs.writeFile(`${out}/qa-result.json`,JSON.stringify({errors,requestedPortraits:[...new Set(requests)]},null,2));await page.screenshot({path:`${out}/last.png`}).catch(()=>{});await browser.close();}
