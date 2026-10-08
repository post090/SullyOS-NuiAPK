import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});const errors=[];await fs.mkdir('output/window-daylight',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1.5});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('sully-home3d-quality','clear'));
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).click(),select=id=>page.evaluate(id=>window.__homeEditor.select(id),id);
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-window-daylight.html?table');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});await page.waitForTimeout(300);
 const initial=await inspect();assert.equal(initial.windowDaylight.length,2);await page.screenshot({path:'output/window-daylight/table-occlusion.png'});
 await select('back-window');await click('height','[data-dy=".2"]');let raised=await inspect();assert.ok(Math.abs(raised.windowDaylight.find(s=>s.id==='back-window').position[1]-initial.windowDaylight[0].position[1]-.2)<.001);
 await click('store');assert.deepEqual((await inspect()).windowDaylight.map(s=>s.id),['left-window']);await click('undo');assert.equal((await inspect()).windowDaylight.length,2);await click('redo');assert.equal((await inspect()).windowDaylight.length,1);await click('undo');
 await click('wall-view','[data-value="hidden"]');assert.equal((await inspect()).windowDaylight.length,2);await click('wall-view','[data-value="cutaway"]');
 await select('back-window');const p=await page.evaluate(()=>window.__homeEditor.projectItem('back-window'));await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+65,p.y+20,{steps:6});await page.waitForTimeout(100);let dragging=await inspect();assert.equal(dragging.placementValid,true);assert.notDeepEqual(dragging.windowDaylight.find(s=>s.id==='back-window').position,raised.windowDaylight.find(s=>s.id==='back-window').position);await page.mouse.up();const moved=await inspect();assert.deepEqual(moved.windowDaylight,dragging.windowDaylight);await click('undo');
 await click('panel','[data-panel="quality"]');for(const q of ['balanced','eco','clear','eco','clear']){await click('quality',`[data-value="${q}"]`);await page.waitForTimeout(100);assert.equal((await inspect()).windowDaylight.length,q==='clear'?2:1);}
 await click('close');await click('edit');await page.waitForTimeout(100);const warm=await inspect();assert.equal(warm.textures,initial.textures);
 // The first pointer drag uploads the editor's reusable selection helper.
 // Compare repeated operations after that warmup, not against an untouched scene.
 for(let i=0;i<3;i++){await select('back-window');await click('store');await click('undo');await click('edit');await click('panel','[data-panel="quality"]');await click('quality','[data-value="eco"]');await click('quality','[data-value="clear"]');await click('close');await page.waitForTimeout(100);}
 const final=await inspect();assert.equal(final.textures,warm.textures);assert.equal(final.geometries,warm.geometries);
 await page.screenshot({path:'output/window-daylight/final.png'});await page.reload();await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});assert.equal((await inspect()).windowDaylight.length,2);
 // An isolated touch device retains a single shadowed source at highest quality.
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(String(e)));await phone.addInitScript(()=>localStorage.setItem('sully-home3d-quality','clear'));await phone.goto('http://127.0.0.1:5174/test/fixtures/room3d-window-daylight.html');await phone.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});assert.equal(await phone.evaluate(()=>window.__homeEditor.inspect().windowDaylight.length),1);await phone.close();
 assert.deepEqual(errors,[]);await fs.writeFile('output/window-daylight/report.json',JSON.stringify({windowCount:initial.windowDaylight.length,movingLight:true,storeUndoRedo:true,hiddenWallsKeepLight:true,qualityLimits:true,stableResources:true,drawCalls:final.drawCalls,errors},null,2));console.log('Window daylight movement, height, storage/history, view modes, quality caps, resource reuse and reload passed');
}finally{await browser.close();}
