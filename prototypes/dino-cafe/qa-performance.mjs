import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='output/dino-garden-qa/performance';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const settle=()=>page.waitForTimeout(600);
const close=()=>page.getByRole('button',{name:'关闭面板',exact:true}).last().click();
async function assertSleeping(label){await settle();const before=(await state()).render;await page.waitForTimeout(650);const after=(await state()).render;assert.equal(after.framesRendered,before.framesRendered,label);return after;}
try{
  await page.goto('http://127.0.0.1:5182/prototypes/dino-cafe/index.html');
  await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).render.loaded.length===4);
  await settle();await page.locator('.clay-guide-close').click();
  const samples=[];for(let i=0;i<30;i++){samples.push((await state()).render);await page.waitForTimeout(70);}
  assert.ok(Math.max(...samples.map(s=>s.drawCalls))<74,'less drawing work than the original 59/74 calls');
  await page.screenshot({path:`${out}/garden-390.png`});
  const baseline=(await state()).render;
  // Changing a prop pose reuses both landscape and editable prop geometry.
  const target=baseline.propTargets.find(p=>p.kind==='stump');await page.touchscreen.tap(target.x,target.y);
  await page.getByRole('button',{name:'调整位置和朝向'}).click();await page.getByRole('button',{name:'向右转45度'}).click();
  const draft=await assertSleeping('placement preview stops when the camera settles');
  assert.equal(draft.terrainBuilds,baseline.terrainBuilds);assert.equal(draft.propBuilds,baseline.propBuilds);
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.getByRole('button',{name:'恐龙',exact:true}).click();await page.getByRole('button',{name:'选择莓莓',exact:true}).click();
  await page.getByRole('button',{name:'换颜色',exact:true}).click();
  const portrait=await assertSleeping('static portrait stops rendering');assert.equal(portrait.morphBuilds,baseline.morphBuilds);
  await page.getByRole('button',{name:'配色蓝莓酪'}).click();await settle();assert.ok((await state()).render.framesRendered>portrait.framesRendered,'paint wakes the portrait');
  await assertSleeping('paint settles');await page.screenshot({path:`${out}/portrait-390.png`});await close();
  await page.getByRole('button',{name:'恐龙',exact:true}).click();await page.getByRole('button',{name:/打开图鉴/}).click();
  const hidden=await assertSleeping('catalog pauses its hidden canvas');assert.equal(hidden.active,false);
  const memories=[];
  for(let i=0;i<3;i++){
    for(const name of ['霸王龙','三角龙']){
      await page.getByRole('button',{name:new RegExp('^'+name+' ')}).click();await settle();
      assert.equal((await state()).render.loaded.length,1);await close();await assertSleeping('closing a portrait does not reload hidden residents');
    }
    memories.push((await state()).render.memory);
  }
  assert.deepEqual(memories[2],memories[0],'repeated portrait visits do not grow GPU geometry or texture counts');
  assert.equal((await state()).render.morphBuilds,baseline.morphBuilds,'cached species morphs are prepared once');
  await page.getByRole('button',{name:'恐龙',exact:true}).click();await close();await settle();
  await page.emulateMedia({reducedMotion:'reduce'});const reduced=await assertSleeping('reduced motion renders on demand');
  await page.emulateMedia({reducedMotion:'no-preference'});await settle();assert.ok((await state()).render.framesRendered>reduced.framesRendered,'motion preference resumes actions');
  await page.setViewportSize({width:1920,height:1080});await settle();assert.ok((await state()).render.drawingPixels<=1_000_000);
  await fs.writeFile(`${out}/report.json`,JSON.stringify({samples,portrait,hidden,memories,reduced,large:(await state()).render,errors},null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({drawCalls:[Math.min(...samples.map(s=>s.drawCalls)),Math.max(...samples.map(s=>s.drawCalls))],terrainBuilds:draft.terrainBuilds,propBuilds:draft.propBuilds,morphBuilds:portrait.morphBuilds,hiddenAndStatic:'zero extra frames',gpuMemory:memories[0],largeDrawingPixels:(await state()).render.drawingPixels}));
}finally{await page.screenshot({path:`${out}/last.png`}).catch(()=>{});await browser.close();}
