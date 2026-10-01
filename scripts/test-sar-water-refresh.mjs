import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='output/fishing-refresh';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
const base='http://127.0.0.1:5173';
const button=name=>page.getByRole('button',{name,exact:true});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
try{
 await page.goto(`${base}/test/fixtures/fishing.html`);await button('抛竿').waitFor();await shot('01-manual-idle');
 assert.equal(await page.locator('.fishing-companions').getAttribute('open'),null);
 const surface=page.locator('.fishing-water canvas');
 assert.equal(await surface.evaluate(el=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;}),true);
 assert.equal(await surface.evaluate(el=>getComputedStyle(el).touchAction),'none');
 await button('简单').click();await button('抛竿').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='caught'&&!JSON.parse(window.render_game_to_text()).saving);
 assert.equal((await read()).inventory.length,1);assert.equal((await state()).simple,true);await shot('02-simple-catch');
 await button('再钓一次').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).inventory.length===2);await page.reload();await button('抛竿').waitFor();assert.equal(await button('简单').getAttribute('aria-pressed'),'true');
 await button('手动').click();await button('抛竿').click();await page.evaluate(()=>window.advanceTime(0));
 for(let i=0;i<320;i++){
  const s=await state();if(s.phase==='caught'||s.phase==='escaped')break;
  const delta=Math.atan2(Math.sin(s.fishAngle-s.playerAngle-s.playerVelocity*.1),Math.cos(s.fishAngle-s.playerAngle-s.playerVelocity*.1));
  if(delta>0)await page.keyboard.down('Space');else await page.keyboard.up('Space');await page.evaluate(()=>window.advanceTime(90));
 }
 await page.keyboard.up('Space');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')).inventory.length===3);assert.equal((await state()).phase,'caught');await shot('03-manual-catch');
 await button('再钓一次').click();await button('收竿').click();assert.equal((await read()).inventory.length,3);
 await button('再钓一次').click();await page.evaluate(()=>window.advanceTime(35000));assert.equal((await state()).phase,'escaped');assert.equal((await read()).inventory.length,3);
 await button('钓鱼说明').click();await page.getByRole('dialog',{name:'钓鱼说明',exact:true}).waitFor();await shot('04-help');await button('关闭钓鱼说明').click();
 await page.getByText('角色钓鱼',{exact:true}).click();assert.equal(await page.getByLabel('选择去水域的角色').isVisible(),true);await shot('05-character-panel');await page.getByText('角色钓鱼',{exact:true}).click();
 await page.setViewportSize({width:320,height:680});await shot('06-small-phone');await page.setViewportSize({width:1100,height:850});await shot('07-desktop');
 await page.setViewportSize({width:390,height:844});await page.goto(`${base}/test/fixtures/kanata.html?npcs=show`);await button('SAR').waitFor();
 await page.evaluate(async()=>{
  const {DB}=await import('/utils/db.ts');
  const img='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#d7a875"/></svg>');
  for(const [id,vrState] of [['connected',{}],['stale',{currentRoom:'sar'}],['elsewhere',{currentRoom:'library',sarActivity:'fishing'}],['actual',{currentRoom:'sar',sarActivity:'fishing',lastActiveAt:Date.now()}]])await DB.saveCharacter({id,name:id,avatar:img,systemPrompt:'fixture',vrState:{enabled:true,activityMode:'manual',intervalMinutes:120,chibi:{img},title:'测试称号',...vrState}});
  localStorage.setItem('vr_sar_club_state_v1',JSON.stringify({version:1,updateSeenVersion:1,npcPreference:'show',caianMet:true}));
 });
 await page.reload();await button('SAR').click();await page.locator('.sar-room-person').first().waitFor();
 assert.deepEqual(await page.locator('.sar-room-person:not(.is-npc)').evaluateAll(els=>els.map(el=>el.dataset.actorId)),['actual']);
 const toggle=page.locator('.sar-hub-tools button[data-room-view]');
 await shot('08-sar-all');
 await toggle.click();assert.equal(await toggle.getAttribute('data-room-view'),'names-hidden');assert.equal(await page.locator('.sar-room-person__name:visible,.sar-room-person__title:visible').count(),0);assert.equal(await page.locator('[data-facility]:visible').count(),6);assert.equal(await page.locator('.sar-room-person:visible').count(),3);await shot('09-sar-names-hidden');
 await toggle.click();assert.equal(await toggle.getAttribute('data-room-view'),'text-hidden');assert.equal(await page.locator('[data-facility]:visible').count(),0);await shot('10-sar-text-hidden');
 await toggle.click();assert.equal(await toggle.getAttribute('data-room-view'),'characters-hidden');assert.equal(await page.locator('.sar-room-person:visible').count(),0);assert.equal(await page.locator('[data-facility]:visible').count(),6);await shot('11-sar-characters-hidden');
 await page.reload();await button('SAR').click();assert.equal(await toggle.getAttribute('data-room-view'),'characters-hidden');assert.equal(await page.locator('.sar-room-person:visible').count(),0);await toggle.click();assert.equal(await toggle.getAttribute('data-room-view'),'all');assert.equal(await page.locator('.sar-room-person:visible').count(),3);
 await page.evaluate(async()=>{const {DB}=await import('/utils/db.ts');const c=(await DB.getAllCharacters()).find(c=>c.id==='elsewhere');await DB.saveCharacter({...c,vrState:{...c.vrState,currentRoom:'sar',sarActivity:'market'}});});
 await page.reload();await button('SAR').click();await page.locator('[data-actor-id="elsewhere"]').waitFor();
 assert.deepEqual(errors,[]);writeFileSync(`${out}/result.json`,JSON.stringify({passed:true,shots:11,pageErrors:errors,checks:['simple instant random catch','manual win/cancel/escape','context menu prevented','mode persistence','four room views','SAR activity-only visitors']},null,2));console.log('Fishing refresh and SAR four-view/presence QA passed.');
}catch(error){await shot('failure');console.error(await page.locator('body').innerText());throw error;}finally{await browser.close();}
