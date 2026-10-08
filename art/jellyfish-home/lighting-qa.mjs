import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});const errors=[],before=process.argv.includes('--before');await fs.mkdir('output/room-lighting',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1.5});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('sully-home3d-quality','clear'));
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-finishes.html');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});await page.waitForTimeout(300);await page.screenshot({path:`output/room-lighting/${before?'before':'after'}-clear.png`});
 if(!before){
  const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).click();const initial=await inspect();assert.equal(initial.lighting.shadowSize,2048);assert.equal(initial.lighting.shadows,true);
  await click('panel','[data-panel="quality"]');for(const q of ['balanced','eco','clear','eco','clear']){await click('quality',`[data-value="${q}"]`);await page.waitForTimeout(100);const s=await inspect();assert.equal(s.lighting.shadows,q!=='eco');assert.equal(s.lighting.shadowSize,q==='clear'?2048:1024);}
  await click('close');const final=await inspect();assert.equal(final.textures,initial.textures);assert.equal(final.geometries,initial.geometries);
  await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-seating.html');await page.waitForFunction(()=>window.__homeEditor&&window.__visitor,undefined,{timeout:90000});await click('panel','[data-panel="chibi"]');await click('chibi-sit','[data-seat="left"]');await click('panel','[data-panel="chibi"]');await click('chibi-view');await page.evaluate(()=>window.advanceTime(0));await page.screenshot({path:'output/room-lighting/child-clear.png'});
  assert.equal(await page.evaluate(()=>{let n=0;window.__visitor.root.traverse(o=>{if(o.isMesh&&o.receiveShadow)n++});return n}),0);
  await click('panel','[data-panel="quality"]');await click('quality','[data-value="eco"]');await click('close');await page.evaluate(()=>window.advanceTime(6000));await page.waitForTimeout(500);const frame=(await inspect()).renderedFrames;await page.waitForTimeout(500);assert.equal((await inspect()).renderedFrames,frame);
  await fs.writeFile('output/room-lighting/report.json',JSON.stringify({lighting:final.lighting,stableResources:true,faceSelfShadow:false,ecoIdleStopped:true,errors},null,2));
 }
 assert.deepEqual(errors,[]);console.log(before?'Baseline captured':'Lighting tiers, cached shadow targets, soft chibi face and eco idle passed');
}finally{await browser.close();}
