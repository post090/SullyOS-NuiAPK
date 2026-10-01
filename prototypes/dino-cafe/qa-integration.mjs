import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/dino-garden-qa/integration';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  window.gardenContexts={created:0,lost:0};const seen=new WeakSet(),original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){const context=original.call(this,type,...args);if(context&&['webgl','webgl2'].includes(type)&&!seen.has(this)){seen.add(this);window.gardenContexts.created++;this.addEventListener('webglcontextlost',()=>window.gardenContexts.lost++);}return context;};
});
await page.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});});
try{
  await page.goto('http://127.0.0.1:5182/test/fixtures/kanata.html',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'下一页房间',exact:true}).click({timeout:60000});
  const entry=page.getByRole('button',{name:'进入恐龙箱庭',exact:true});await entry.waitFor();await page.waitForTimeout(300);
  await page.screenshot({path:`${out}/sar-390.png`});await entry.click();await page.waitForSelector('.clay-app[data-ready="true"]',{timeout:30000});
  let s=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(s.residents.length,1);assert.equal(s.maps.length,3);assert.equal(s.visits,false);assert.equal(s.residents[0].species,'tyrannosaurus');await page.screenshot({path:`${out}/real-garden-390.png`});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
  await page.getByRole('button',{name:'返回 SAR 活动室'}).click();await page.getByRole('button',{name:'进入水域',exact:true}).click();await page.getByRole('button',{name:'图鉴',exact:true}).click();
  await page.getByRole('button',{name:'带橡皮泥恐龙去箱庭 →',exact:true}).waitFor();assert.ok(await page.getByRole('img',{name:'霸王龙橡皮泥模型'}).count());
  await page.screenshot({path:`${out}/fishing-collection.png`});await page.getByRole('button',{name:'带橡皮泥恐龙去箱庭 →',exact:true}).click();await page.waitForSelector('.clay-app[data-ready="true"]');
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')));assert.deepEqual(after.inventory,saved.inventory);assert.deepEqual(after.dinosaurGarden,saved.dinosaurGarden);
  await page.getByRole('button',{name:'返回 SAR 活动室'}).click();await page.setViewportSize({width:320,height:740});await page.screenshot({path:`${out}/sar-320.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
  await page.waitForFunction(()=>window.gardenContexts.lost===window.gardenContexts.created&&window.gardenContexts.created>=2);
  assert.deepEqual(errors,[]);console.log('Real SAR entry, starter ownership, fishing collection and garden return verified at 390 / 320.');
}finally{await fs.writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));await page.screenshot({path:`${out}/last.png`}).catch(()=>{});await browser.close();}
