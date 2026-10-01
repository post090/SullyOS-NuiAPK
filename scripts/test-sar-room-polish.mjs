import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='output/sar-room-polish';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],frames=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
await page.addInitScript(()=>localStorage.setItem('vr_sar_club_state_v1',JSON.stringify({version:1,updateSeenVersion:1,npcPreference:'show',caianMet:true})));
const button=name=>page.getByRole('button',{name,exact:true});
const shot=name=>page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});
const idle=()=>page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text?.()||'{}');return s.mode==='sar-familiarity'&&!s.busy&&!s.error&&s.text!=='正在走进活动室…';});
const compareFrame=async name=>{
    await page.waitForFunction(()=>document.querySelector('.srf-room-viewport img')?.complete);
    const frame=await page.evaluate(()=>{
        const live=document.querySelector('.sar-room-background').getBoundingClientRect();
        const img=document.querySelector('.srf-room-viewport img'),box=img.getBoundingClientRect();
        const scale=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight),width=img.naturalWidth*scale,height=img.naturalHeight*scale;
        return {live:{x:live.x,y:live.y,width:live.width,height:live.height},dialogue:{x:box.x+(box.width-width)/2,y:box.y+(box.height-height)/2,width,height}};
    });
    for(const key of ['x','y','width','height'])assert(Math.abs(frame.live[key]-frame.dialogue[key])<1,`${name}: room ${key} changed: ${JSON.stringify(frame)}`);
    frames.push({name,...frame});await shot(name);
};
try{
    await page.goto(`${process.env.SAR_QA_URL||'http://127.0.0.1:5173'}/test/fixtures/kanata.html?npcs=show`);await button('SAR').click();await button('与凯恩交谈').waitFor();
    // A deterministic authored topic avoids advancing the real user's data or making model calls.
    await page.evaluate(async()=>{const m=await import('/utils/vrWorld/fishingMarket.ts'),f=await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts'),s=await import('/utils/vrWorld/sarFamiliarity/state.ts');const state=m.readFishingMarketState();state.sarFamiliarity=f.freshFamiliarity();state.sarFamiliarity.npcs.caian.day=s.familiarityDay();state.sarFamiliarity.npcs.caian.offerId='C1-01';m.saveFishingMarketState(state);});
    for(const viewport of [{width:390,height:844},{width:320,height:680},{width:1100,height:850},{width:740,height:390}]){
        await page.setViewportSize(viewport);await shot('room-'+viewport.width);await button('与凯恩交谈').click();await idle();await compareFrame('dialogue-'+viewport.width);await button('离开对话').click();
    }
    await page.setViewportSize({width:390,height:844});await button('活动室设置').click();await page.getByRole('heading',{name:'活动室设置',exact:true}).waitFor();
    const toggle=page.getByRole('switch',{name:'显示常驻 NPC'});assert.equal(await toggle.getAttribute('aria-checked'),'true');await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'false');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_sar_club_state_v1')).npcPreference),'hide');await toggle.click();await shot('settings');
    await button('回到初见前').click();const confirm=page.getByRole('dialog',{name:'回档凯恩初次见面？',exact:true});await confirm.waitFor();
    assert(await confirm.evaluate(el=>el.contains(document.activeElement)),'rewind confirm owns focus');await shot('rewind-confirm');await page.keyboard.press('Escape');await confirm.waitFor({state:'detached'});await page.getByRole('heading',{name:'活动室设置',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_sar_club_state_v1')).caianMet),true);
    await button('回到初见前').click();await button('确认回档').click();await confirm.waitFor({state:'detached'});assert(await button('剧情未完成').isDisabled());
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_sar_club_state_v1')).caianMet),false);await button('返回活动室').click();
    await page.getByRole('button',{name:/与凯恩|凯恩.*交谈/}).click();await page.locator('.srf-dialog').waitFor();await compareFrame('initial-meeting');await button('暂时离开对话').click();
    await button('打开仓库').click();await button('打开收集图鉴').click();await button('名册').click();
    await page.waitForFunction(()=>document.querySelector('.sar-roster-portrait img:not(.sar-npc-portrait__pending)')?.getAttribute('src')?.endsWith('/normal.webp'));
    assert.equal(await page.locator('.sar-roster-portrait .sar-npc-portrait').getAttribute('data-expression'),'normal');await shot('caian-normal-roster');
    await page.getByRole('navigation',{name:'图鉴页面'}).getByRole('button',{name:'收藏',exact:true}).click();await page.keyboard.press('Escape');await button('返回活动室').click();await button('返回彼方').click();await button('接入').click();
    assert.equal(await page.getByRole('switch',{name:'显示常驻 NPC'}).count(),0);assert.equal(await button('回到初见前').count(),0);assert(!(await page.locator('body').innerText()).includes('活动空间 NPC'));await shot('participation');
    assert.deepEqual(errors,[]);writeFileSync(`${out}/result.json`,JSON.stringify({frames,errors,checks:['unchanged background framing in four viewports and initial meeting','NPC preference stored','rewind focus and Escape','rewind only clears intro','roster normal portrait','SAR controls removed from participation']},null,2));console.log('SAR room polish passed: background, settings, rewind and roster.');
}catch(error){await shot('failure');console.error((await page.locator('body').innerText()).slice(-2500));throw error;}finally{await browser.close();}
