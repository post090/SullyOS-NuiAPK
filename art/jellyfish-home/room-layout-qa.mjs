import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
await fs.mkdir('output/room-layout',{recursive:true});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-layout.html');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).click(),shot=async name=>{await page.evaluate(()=>window.advanceTime(0));await page.screenshot({path:`output/room-layout/${name}.png`});};
 let s=await inspect();const [left,right]=s.rooms;assert.equal(s.visibleRoomIds.length,2);assert.equal(s.detailRooms,2);assert.equal(s.overview,false);assert.equal(s.roomGroups.length,2);await shot('default-two-rooms');
 await click('panel','[data-panel="building"]');const before=await page.evaluate(()=>window.__homeEditor.projectPoint([4.65,2,0]));
 await click('building-room',`[data-id="${right.id}"]`);const after=await page.evaluate(()=>window.__homeEditor.projectPoint([-4.65,2,0]));assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.1,'switching edit ownership must not jump the camera');
 await click('boundary-edge','[data-value="left"]');await click('boundary-kind','[data-value="open"]');s=await inspect();assert.equal(s.roomGroups.length,1);assert.equal(s.rooms[0].boundaries.right.kind,'open');await click('close');await shot('merged');
 await click('undo');assert.equal((await inspect()).roomGroups.length,2);await click('redo');assert.equal((await inspect()).roomGroups.length,1);
 await click('panel','[data-panel="building"]');await click('boundary-kind','[data-value="wall_low"]');assert.equal((await inspect()).roomGroups.length,2);await click('close');
 // Pick the visible shared partition directly, regardless of which room owns its mesh.
 const p=await page.evaluate(()=>{const p=window.__homeEditor.projectPoint([-4.65,.65,0]),r=document.querySelector('.h3-stage').getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};});await page.mouse.click(p.x,p.y);assert.equal((await inspect()).panel,'building');await shot('pick-partition');
 await click('boundary-kind','[data-value="open"]');assert.equal((await inspect()).roomGroups.length,1);
 const saved=(await inspect()).rooms;await page.reload();await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});assert.deepEqual((await inspect()).rooms,saved);assert.equal((await inspect()).visibleRoomIds.length,2);
 await page.setViewportSize({width:390,height:844});await click('panel','[data-panel="building"]');assert.equal(await page.locator('[data-action="building-room"]').count(),2);assert.equal(await page.locator('.h3-dock').evaluate(el=>el.scrollWidth>el.clientWidth),false);await shot('mobile-building');
 assert.deepEqual(errors,[]);console.log('Layout: default neighbors, camera continuity, direct wall picking, merge/split, undo/redo, save and mobile passed.');
}finally{await browser.close();}
