import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});await fs.mkdir('output/phone-budget',{recursive:true});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-phone-budget.html');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).click();let s=await inspect();assert.deepEqual(s.phoneBudget,{rooms:5,furniture:15});assert.equal(s.detailRooms,1);assert.equal(s.rooms.flatMap(r=>r.items).length,75);const before=s.rooms;
 await click('panel','[data-panel="expand"]');await click('expand','[data-direction="front"]');s=await inspect();assert.deepEqual(s.rooms,before);assert.equal(s.undoCount,0);assert.match(s.message,/5 块/);await page.screenshot({path:'output/phone-budget/room-limit.png'});
 await click('panel','[data-panel="furniture"]');await click('catalog-mode','[data-value="use"]');await click('category','[data-value="lighting"]');await click('add-item','[data-id="pendant"]');s=await inspect();assert.deepEqual(s.rooms,before);assert.match(s.message,/15 件/);assert.equal(s.undoCount,0);await page.screenshot({path:'output/phone-budget/furniture-limit.png'});
 await page.evaluate(()=>window.__homeEditor.select('r0-chair-0'));await click('store');s=await inspect();assert.equal(s.furnitureCounts.r0,14);await click('panel','[data-panel="furniture"]');await click('add-item','[data-id="pendant"]');s=await inspect();assert.equal(s.furnitureCounts.r0,15);assert.equal(s.undoCount,2);
 // Restoring the stored chair cannot bypass the active furnishing allowance.
 await click('panel','[data-panel="storage"]');await click('restore','[data-id="r0-chair-0"]');assert.match((await inspect()).message,/15 件/);assert.equal((await inspect()).rooms[0].items.find(i=>i.id==='r0-chair-0').stored,true);
 await click('undo');assert.equal((await inspect()).furnitureCounts.r0,14);await click('redo');assert.equal((await inspect()).furnitureCounts.r0,15);
 await click('edit');await page.waitForTimeout(500);const perf=await inspect();await page.waitForTimeout(500);assert.equal((await inspect()).renderedFrames,perf.renderedFrames);await fs.writeFile('output/phone-budget/performance.json',JSON.stringify({items:75,detailed:perf.detailRooms,calls:perf.drawCalls,triangles:perf.triangles,idleStopped:true},null,2));
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-phone-budget.html?legacy');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});assert.equal((await inspect()).rooms.length,6);await page.evaluate(()=>window.__homeEditor.select('r0-chair-0'));await click('store');assert.equal((await inspect()).furnitureCounts.r0,14);
 assert.deepEqual(errors,[]);console.log('Phone 5/15 limits, atomic rejection, storage/history, legacy preservation and idle rendering passed.',perf.drawCalls,perf.triangles);
}finally{await browser.close();}
