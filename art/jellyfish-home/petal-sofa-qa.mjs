import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'playwright');
const buffer=await readFile('public/room3d/petal-sofa.glb'),gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);
assert.equal(gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0),4858);
const kit=await readFile('public/room3d/kit.glb'),kitJson=JSON.parse(kit.subarray(20,20+kit.readUInt32LE(12)));
assert.deepEqual(gltf.materials.find(m=>m.name==='woodLight').pbrMetallicRoughness.baseColorFactor,kitJson.materials.find(m=>m.name==='woodLight').pbrMetallicRoughness.baseColorFactor);
const chair=await readFile('public/room3d/petal-armchair.glb'),chairJson=JSON.parse(chair.subarray(20,20+chair.readUInt32LE(12)));
assert.equal(chairJson.images?.length||0,0);assert.equal(chairJson.textures?.length||0,0);assert.equal(chairJson.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+chairJson.accessors[p.indices].count/3,0),3624);
assert.deepEqual(chairJson.materials.find(m=>m.name==='woodLight').pbrMetallicRoughness.baseColorFactor,kitJson.materials.find(m=>m.name==='woodLight').pbrMetallicRoughness.baseColorFactor);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:900,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await mkdir('output/sofa-review/installed',{recursive:true});
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-building.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__homeEditor);
 const click=(action,extra='')=>page.locator(`[data-action="${action}"]${extra}`).click(),inspect=()=>page.evaluate(()=>window.__homeEditor.inspect());
 await click('panel','[data-panel="furniture"]');await click('catalog-mode','[data-value="use"]');await click('category','[data-value="seating"]');assert.equal(await page.locator('[data-id="petal_sofa"]').count(),1);assert.equal(await page.locator('[data-id="petal_armchair"]').count(),1);
 await click('add-item','[data-id="petal_sofa"]');const first=await inspect(),id=first.selected;assert.ok(first.rooms[0].items.some(i=>i.id===id&&i.assetId==='petal_sofa'));assert.equal(first.message,'拖动试试新的位置');
 await page.screenshot({path:'output/sofa-review/installed/original-color.png'});
 // Clear the nearby table so a quarter-turn tests rotation without an expected collision.
 const table=first.rooms[0].items.find(i=>i.assetId==='table');await page.evaluate(id=>window.__homeEditor.select(id),table.id);await click('store');await page.evaluate(id=>window.__homeEditor.select(id),id);
 await click('rotate');await click('place-rotation');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===id).rotation,90);
 await click('undo');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===id).rotation,0);
 await page.evaluate(id=>window.__homeEditor.select(id),id);await click('palette');await click('color','[data-value="#91C9F4"]');
 assert.equal((await inspect()).rooms[0].items.find(i=>i.id===id).color,'#91C9F4');await page.screenshot({path:'output/sofa-review/installed/blue-cushions.png'});
 await click('store');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===id).stored,true);
 await click('panel','[data-panel="storage"]');await click('restore',`[data-id="${id}"]`);assert.equal((await inspect()).rooms[0].items.find(i=>i.id===id).stored,false);
 await click('panel','[data-panel="furniture"]');await click('add-item','[data-id="petal_armchair"]');const singleId=(await inspect()).selected;await click('palette');await click('color','[data-value="#91C9F4"]');assert.equal((await inspect()).rooms[0].items.find(i=>i.id===singleId).color,'#91C9F4');await page.screenshot({path:'output/sofa-review/installed/blue-armchair.png'});
 const saved=(await inspect()).rooms;await page.reload();await page.waitForFunction(()=>window.__homeEditor);assert.deepEqual((await inspect()).rooms,saved);
 assert.deepEqual(errors,[]);console.log('PETAL_SOFA_PASS: wood, no images, load, category, rotate, undo, recolor, store, restore, reload');
}finally{await browser.close();}
