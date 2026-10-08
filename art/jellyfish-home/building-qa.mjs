import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:430,height:860},hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await mkdir('output/building-qa',{recursive:true});
try{
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-building.html');await page.waitForFunction(()=>window.__homeEditor);
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect());
 const click=(action,extra='')=>page.locator(`[data-action="${action}"]${extra}`).click();
 const selected=async()=>{const s=await inspect();return s.rooms[0].items.find(i=>i.id===s.selected)};
 const shot=name=>page.screenshot({path:`output/building-qa/${name}.png`});
 await shot('empty-entry');
 await click('panel','[data-panel="building"]');await page.locator('.h3-sheet summary').click();await click('add-item','[data-id="wall_high"]');
 const first=await selected();assert.equal(first.assetId,'wall_high');await shot('high');
 await click('building-length','[data-delta=".2"]');assert.equal((await selected()).length,1.4);
 await click('building-type','[data-id="wall_low"]');const low=await selected();assert.equal(low.assetId,'wall_low');assert.equal(low.x,first.x);assert.equal(low.z,first.z);await shot('low');
 const point=await page.evaluate(id=>window.__homeEditor.projectItem(id),first.id),before=await selected();
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x-24,point.y+2,{steps:6});await page.mouse.up();
 const moved=await selected();assert.ok(moved.x!==before.x||moved.z!==before.z,'Drag must move the wall');
 await click('building-type','[data-id="wall_fence"]');assert.equal((await selected()).length,1.4);await shot('fence');
 await click('rotate');await click('place-rotation');assert.equal((await selected()).rotation,90);
 await click('undo');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===first.id).rotation,0);
 await click('redo');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===first.id).rotation,90);
 await page.evaluate(id=>window.__homeEditor.select(id),first.id);
 await click('copy');const copy=await selected();assert.equal(copy.length,1.4);assert.notEqual(copy.id,first.id);
 await click('remove-building');assert.ok(!(await inspect()).rooms[0].items.some(i=>i.id===copy.id));
 await click('undo');assert.ok((await inspect()).rooms[0].items.some(i=>i.id===copy.id));
 await click('redo');assert.ok(!(await inspect()).rooms[0].items.some(i=>i.id===copy.id));
 const saved=(await inspect()).rooms;
 await page.reload();await page.waitForFunction(()=>window.__homeEditor);assert.deepEqual((await inspect()).rooms,saved);
 await click('panel','[data-panel="furniture"]');assert.equal(await page.locator('[data-action="category"]').count(),11);
 await click('category','[data-value="building"]');assert.equal(await page.locator('[data-action="add-item"]').count(),3);
 await click('close');await shot('saved-fence');
 await page.evaluate(id=>window.__homeEditor.select(id),first.id);
 for(const [edge,axis,at,rotation] of [['front','z',2.65,0],['left','x',-3.1,90],['right','x',3.1,90],['back','z',-2.65,0]]){
  await click('building-edge',`[data-value="${edge}"]`);const wall=await selected();assert.equal(wall[axis],at);assert.equal(wall.rotation,rotation);await shot(`edge-${edge}`);
 }
 await click('undo');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===first.id).x,3.1);
 await click('redo');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===first.id).z,-2.65);
 const boundarySaved=(await inspect()).rooms;await page.reload();await page.waitForFunction(()=>window.__homeEditor);assert.deepEqual((await inspect()).rooms,boundarySaved);
 await page.setViewportSize({width:320,height:700});await page.evaluate(id=>window.__homeEditor.select(id),first.id);await shot('mobile-controls');
 const overflow=await page.locator('.h3-dock').evaluate(el=>el.scrollWidth>el.clientWidth);assert.equal(overflow,false,'Dock must fit mobile viewport');
 const stats=await inspect();await writeFile('output/building-qa/result.json',JSON.stringify({errors,checks:'add/high/low/fence/length/rotate/drag/copy/remove/undo/redo/reload/categories/mobile',drawCalls:stats.drawCalls},null,2));
 assert.deepEqual(errors,[]);console.log('BUILDING_QA_PASS',stats.drawCalls,'draw calls');
}finally{await browser.close();}
