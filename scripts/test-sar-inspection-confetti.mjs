import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='output/sar-inspection-confetti';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,reducedMotion:'no-preference'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
const base='http://127.0.0.1:5173';
const view=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const open=async(scene,node,line=0)=>{await page.goto(base+'/test/fixtures/sar-dialogue.html?scene='+scene+'&node='+node+'&line='+line);await page.waitForFunction(()=>document.documentElement.dataset.qaPositioned==='true');await page.waitForTimeout(500);};
try{
 for(const [scene,node,line] of [['C1-SPECIAL','membership',0],['C3-SPECIAL','spare-card',1]]){
  // Resolve the membership node from the actual scene rather than duplicating its authored name.
  let target=node;
  if(node==='membership'){
   await page.goto(base+'/test/fixtures/sar-dialogue.html?scene=C1-SPECIAL&node=start');
   target=await page.evaluate(async()=>Object.entries((await import('/utils/vrWorld/sarFamiliarity/catalog.ts')).familiarityScene('C1-SPECIAL').nodes).find(([,n])=>n.effect?.kind==='membership-card')[0]);
  }
  await open(scene,target,line);const before=await view();
  await page.getByRole('button',{name:'放大查看物品',exact:true}).click();
  const inspector=page.locator('.sar-object-inspector');await inspector.waitFor();
  assert.equal((await view()).confirmed,before.confirmed);
  assert.equal(await inspector.getByRole('button',{name:'就用这个形象',exact:true}).count(),0);
  await page.screenshot({path:out+'/'+scene+'-enlarged.png'});
  await page.keyboard.press('Escape');await inspector.waitFor({state:'detached'});
  const after=await view();assert.equal(after.node,before.node);assert.equal(after.line,before.line);assert.equal(after.sentence,before.sentence);assert.equal(after.confirmed,before.confirmed);
  assert.equal(await page.getByRole('button',{name:'放大查看物品',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.screenshot({path:out+'/'+scene+'-inline.png'});
  if(scene==='C1-SPECIAL'){
    const button=await page.getByRole('button',{name:'就用这个形象',exact:true}).boundingBox();const frame=await page.locator('.srf-prop-content').boundingBox();assert.ok(button.y+button.height<=frame.y+frame.height+1,'membership controls fit without scrolling');
    await page.locator('.sar-artifact-identity').click();await inspector.waitFor();
    await page.getByRole('button',{name:'关闭物品详情',exact:true}).click();
    assert.equal((await view()).confirmed,false);
  }
 }
 await open('A2-SPECIAL','confetti');
 const confetti=page.locator('.srf-global-confetti');await confetti.waitFor();
 const bounds=await confetti.boundingBox();assert.deepEqual(bounds,{x:0,y:0,width:390,height:844});
 assert.equal(await confetti.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 await page.waitForTimeout(800);await page.screenshot({path:out+'/global-confetti.png'});
 await page.getByRole('button',{name:'继续对话',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).line===1 && !JSON.parse(window.render_game_to_text()).busy);assert.equal((await view()).line,1);assert.equal(await confetti.count(),1);
 await page.getByRole('button',{name:'继续对话',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).sentence===1);
 await page.getByRole('button',{name:'继续对话',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).node==='button');
 assert.equal(await confetti.count(),0);
 assert.deepEqual(errors,[]);writeFileSync(out+'/report.json',JSON.stringify({inspection:true,noAccidentalConfirmation:true,fullViewportConfetti:true,errors},null,2));
 console.log('PASS: item inspection returns to the same sentence without confirming; full-screen confetti allows continuing and cleans up.');
}finally{await browser.close();}
