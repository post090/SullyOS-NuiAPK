import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});const errors=[];await fs.mkdir('output/room-finishes',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-finishes.html');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).click(),shot=async name=>{await page.waitForTimeout(150);await page.screenshot({path:`output/room-finishes/${name}.png`});};
 const initial=await inspect(),[a,b]=initial.rooms;await shot('two-rooms');
 await click('panel','[data-panel="room-style"]');await click('room-finish','[data-part="wallStyle"][data-value="panel"]');await click('room-finish','[data-part="floorStyle"][data-value="tile"]');let s=await inspect();assert.equal(s.rooms[0].wallStyle,'panel');assert.deepEqual(s.rooms[1],b);
 await click('undo');assert.equal((await inspect()).rooms[0].floorStyle,'checker');await click('redo');assert.equal((await inspect()).rooms[0].floorStyle,'tile');
 await click('panel','[data-panel="room-style"]');await click('style-room',`[data-id="${b.id}"]`);await click('room-finish','[data-part="floorStyle"][data-value="solid"]');assert.equal((await inspect()).rooms[0].floorStyle,'tile');await shot('controls');
 await click('close');const saved=(await inspect()).rooms;await page.reload();await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});assert.deepEqual((await inspect()).rooms,saved);
 await click('panel','[data-panel="building"]');await click('boundary-edge','[data-value="left"]');await click('boundary-door','[data-value="arch"]');await click('close');await shot('shared-arch');
 await click('panel','[data-panel="building"]');await click('boundary-kind','[data-value="open"]');assert.equal((await inspect()).roomGroups.length,1);await click('close');await shot('merged-finishes');
 await click('undo');assert.equal((await inspect()).roomGroups.length,2);
 await click('wall-view','[data-value="hidden"]');await shot('no-walls');await click('wall-view','[data-value="cutaway"]');
 await click('panel','[data-panel="room-style"]');await click('room-finish','[data-part="floorStyle"][data-value="wood"]');await click('room-finish','[data-part="wallStyle"][data-value="dot"]');await page.waitForTimeout(250);const baseline=await inspect();
 for(let n=0;n<4;n++){await click('room-finish','[data-part="floorStyle"][data-value="checker"]');await click('room-finish','[data-part="wallStyle"][data-value="stripe"]');await click('room-finish','[data-part="floorStyle"][data-value="wood"]');await click('room-finish','[data-part="wallStyle"][data-value="dot"]');}
 await page.waitForTimeout(250);s=await inspect();for(const k of ['geometries','textures','materials','finishMaterials'])assert.equal(s[k],baseline[k],k+' leaked');const frames=s.renderedFrames;await page.waitForTimeout(500);assert.equal((await inspect()).renderedFrames,frames);
 await page.setViewportSize({width:360,height:780});await shot('mobile-controls');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);console.log('Room-specific finishes, shared wall/arch, merge/history/reload, mobile, idle and resource reuse passed.');
}finally{await browser.close();}
