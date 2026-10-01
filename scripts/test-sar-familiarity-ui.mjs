import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='output/fishing-qa/npc-lines/ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
await context.addInitScript(()=>['gacha','water','garden','warehouse','shop','board','cabinet'].forEach(id=>localStorage.setItem('sar-facility-guide-'+id+'-v1','done')));
const button=name=>page.getByRole('button',{name,exact:true});
const shot=async(name)=>{await page.waitForFunction(()=>Array.from(document.querySelectorAll('.srf-dialog .sar-npc-portrait')).every(el=>el.getAttribute('aria-busy')!=='true'));await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');};
const close=async()=>{if(await button('离开对话').count())await button('离开对话').click();};
const node=async(id,nodeId,line=0)=>{
    await close();
    await page.evaluate(async({id,nodeId,line})=>{
        const market=await import('/utils/vrWorld/fishingMarket.ts'),catalog=await import('/utils/vrWorld/sarFamiliarity/catalog.ts'),storage=await import('/utils/vrWorld/sarFamiliarity/storageTypes.ts');
        const scene=catalog.familiarityScene(id),state=market.readFishingMarketState();if(!scene.nodes[nodeId||scene.start])throw new Error('Bad fixture node '+nodeId);state.sarFamiliarity||=storage.freshFamiliarity();
        state.sarFamiliarity.npcs[scene.npc].pending={runId:id+':ui',sceneId:id,nodeId:nodeId||scene.start,line,revision:0,startedAt:Date.now(),flags:{meetingConclusion:'下次再议'},drafts:{},userName:'小雨',sullyId:'ui-sully'};
        market.saveFishingMarketState(state);
    },{id,nodeId,line});
    await button(id.startsWith('C')?'与凯恩交谈':'与艾文交谈').click();await page.locator('.srf-dialog').waitFor();
    await page.waitForFunction(id=>{const s=JSON.parse(window.render_game_to_text());return s.mode==='sar-familiarity'&&s.scene===id&&!s.busy;},id);
    if(nodeId||line){
        await page.evaluate(async({nodeId,line})=>{const m=await import('/utils/vrWorld/fishingMarket.ts'),s=m.readFishingMarketState(),view=JSON.parse(window.render_game_to_text()),c=s.sarFamiliarity.npcs[view.npc].pending;c.nodeId=nodeId||c.nodeId;c.line=line;c.flags={meetingConclusion:'下次再议'};m.saveFishingMarketState(s);},{nodeId,line});
        await page.waitForFunction(({nodeId,line})=>{const s=JSON.parse(window.render_game_to_text());return (!nodeId||s.node===nodeId)&&s.line===line&&!s.busy;},{nodeId,line});
    }
};
// Advance one authored line, including any sentence pages within it.
const next=async()=>{const before=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));for(let i=0;i<40;i++){await button('继续对话').click();await page.waitForFunction(()=>!document.querySelector('.srf-dialog')||!JSON.parse(window.render_game_to_text()).busy);if(!await page.locator('.srf-dialog').count())return;const after=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));if(after.node!==before.node||after.line!==before.line||after.finished||after.choices.length)return;}throw new Error('Dialogue did not advance');};
const finish=async()=>{for(let i=0;i<150&&await page.locator('.srf-dialog').count();i++){const choice=page.locator('.sar-dialogue-choices__list button').first();if(await choice.count()){await choice.click();await page.waitForFunction(()=>!document.querySelector('.srf-dialog')||!JSON.parse(window.render_game_to_text()).busy);}else await next();}assert.equal(await page.locator('.srf-dialog').count(),0);};
try{
    await page.goto(`${process.env.SAR_QA_URL||'http://127.0.0.1:5177'}/test/fixtures/kanata.html?npcs=show`);await button('SAR').waitFor();
    await page.evaluate(async()=>{
        const {DB}=await import('/utils/db.ts'),m=await import('/utils/vrWorld/fishingMarket.ts'),commerce=await import('/utils/vrWorld/sarCommerce.ts');
        const img='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="77" rx="22" ry="22" fill="#c2a9b4"/><circle cx="50" cy="38" r="26" fill="#ecdcc5"/><path d="M23 38 Q14 2 52 5 Q88 4 77 42 L65 25 43 29 36 21Z" fill="#86765c"/><circle cx="40" cy="40" r="2" fill="#54483b"/><circle cx="60" cy="40" r="2" fill="#54483b"/></svg>');
        await DB.saveUserProfile({...await DB.getUserProfile(),name:'小雨',vrState:{enabled:true,currentRoom:'sar',sarActivity:'fishing',chibi:{img}}});
        await DB.saveCharacter({id:'ui-sully',name:'Sully',avatar:'',systemPrompt:'fixture',vrState:{enabled:true,activityMode:'manual',intervalMinutes:120,currentRoom:'sar',chibi:{img}}});
        localStorage.setItem('vr_sar_club_state_v1',JSON.stringify({version:1,updateSeenVersion:1,npcPreference:'show',caianMet:true}));
        m.saveFishingMarketState({...m.createFishingMarketState(17),accounts:{user:120}});await commerce.ensureSARCommerce();
    });
    await page.reload();await button('SAR').click();await button('与凯恩交谈').waitFor();
    await node('C1-01');await page.waitForFunction(()=>document.querySelector('.srf-stage .sar-npc-portrait__image:not(.sar-npc-portrait__pending)')?.naturalWidth>0);assert.equal(await page.locator('.srf-stage .sar-dialogue-cast__actor').count(),1);assert.equal(await page.locator('.srf-stage .cast-aiven').count(),0);await shot('01-daily-caian');
    const before=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));await close();await button('与凯恩交谈').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).scene==='C1-01');assert.equal((await page.evaluate(()=>JSON.parse(window.render_game_to_text()))).node,before.node);
    await node('A1-03');await next();await page.waitForFunction(()=>document.querySelector('.cast-aiven [data-expression="interested"] img:not(.sar-npc-portrait__pending)')?.naturalWidth>0);assert.equal(await page.locator('.srf-stage .sar-dialogue-cast__actor').count(),1);assert.equal(await page.locator('.srf-stage .cast-caian').count(),0);await shot('02-aiven-interested');
    await node('A1-SPECIAL','working');assert.equal(await page.locator('.srf-stage .cast-caian').count(),0,'mentioning Caian does not make him appear');await shot('21-personal-mention');
    await next();assert.equal(await page.locator('.srf-stage .sar-dialogue-cast__actor').count(),2);await page.waitForFunction(()=>document.querySelector('.srf-stage .cast-caian img:not(.sar-npc-portrait__pending)')?.naturalWidth>0);await shot('22-guest-speaks');
    await close();await button('与艾文交谈').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).node==='start');assert.equal(await page.locator('.srf-stage .sar-dialogue-cast__actor').count(),1,'interrupted event restarts');
    await node('A1-SPECIAL','working');await next();await next();assert.equal(await page.locator('.srf-stage .cast-caian').count(),1,'the guest stays for the protagonist reaction in this exchange');await shot('23-guest-stays-for-reaction');
    await node('C1-SPECIAL','member-card');await button('就用这个形象').waitFor();assert(await button('继续对话').isDisabled());await shot('03-membership');await button('就用这个形象').click();await next();await finish();
    assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarFamiliarity.souvenirs.some(s=>s.id==='caian-membership')));
    await node('C2-SPECIAL','photo-studio');await button('拍好了').waitFor();await shot('04-photo-edit');
    await page.getByRole('button',{name:'朋友入镜',exact:true}).click();await page.getByRole('button',{name:/Sully/}).last().click();
    await button('拍好了').click();await shot('05-photo-saved');await next();await finish();
    const photo=await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).sarFamiliarity.souvenirs.find(s=>s.id==='caian-photo'));assert.equal(photo.draft.photo.actors.length,4);assert(photo.draft.caption.includes('朋友们也都在'));
    await node('C2-SPECIAL','meeting-record');await shot('06-meeting-log');
    await node('C3-SPECIAL','reward');await shot('07-memory-card');
    await node('A2-E03','rain');await shot('08-coupon-rain');
    await node('A3-SPECIAL','loot');await shot('09-loot-burst');
    await node('A3-SPECIAL','chimera');await next();await page.locator('.srf-fx-chimera canvas').waitFor({timeout:20000});await page.waitForFunction(()=>document.querySelector('.srf-fx-chimera-model')?.getAttribute('data-model-ready')==='true');await page.waitForTimeout(900);await shot('10-chimera');
    await node('A3-E03','button');await button('按下神秘按钮').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).node==='confetti');await shot('19-mystery-confetti');
    await close();await button('打开仓库').click();await page.getByTestId('sar-wallet-balance').waitFor();await button('纪念').click();await shot('11-keepsakes');
    await page.getByRole('button',{name:/^第一次 SAR 会议 ·/}).click();await button('收好纪念物').waitFor();await shot('12-keepsake-photo');await button('看看背面').click();await shot('13-photo-back');await page.keyboard.press('Escape');assert.equal(await button('收好纪念物').count(),0);
    // Real collection -> roster -> replay; replay must not touch the whole canonical save.
    await page.evaluate(async()=>{const m=await import('/utils/vrWorld/fishingMarket.ts'),s=m.readFishingMarketState();s.sarFamiliarity.npcs.caian.completed['C1-01']={at:Date.now(),flags:{}};s.sarFamiliarity.npcs.caian.stars=1;delete s.sarFamiliarity.npcs.caian.pending;m.saveFishingMarketState(s);});
    await button('打开收集图鉴').click();await button('名册').click();await shot('14-roster-profile');await page.getByRole('button',{name:/^回忆/}).click();await page.getByText('一星篇章',{exact:true}).click();await button('回顾彼方也太方便了吧').click();
    const saved=await page.evaluate(()=>localStorage.getItem('vr_fishing_market_v1'));assert.equal(await page.locator('.srf-stage .sar-dialogue-cast__actor').count(),1,'replay uses the same solo rule');await shot('15-replay');await next();await button('确实').click();await next();assert.equal(await page.evaluate(()=>localStorage.getItem('vr_fishing_market_v1')),saved);await close();
    await page.setViewportSize({width:320,height:680});await shot('16-roster-320');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await node('C1-01');await shot('17-dialog-320');await page.setViewportSize({width:1100,height:850});await shot('18-dialog-desktop');
    await page.setViewportSize({width:390,height:844});await node('C3-SPECIAL','love-token');await page.waitForFunction(()=>document.querySelector('.cast-caian [data-expression="shy"] img:not(.sar-npc-portrait__pending)')?.naturalWidth>0);await shot('20-caian-shy');
    assert.deepEqual(errors,[]);writeFileSync(`${out}/result.json`,JSON.stringify({passed:true,screenshots:23,pageErrors:errors},null,2));console.log('SAR familiarity integration passed');
}catch(error){await page.screenshot({path:`${out}/failure.png`});console.error(await page.locator('body').innerText());throw error;}
finally{await browser.close();}
