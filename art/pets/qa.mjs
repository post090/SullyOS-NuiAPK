import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'file:///C:/Users/tiaotiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.PET_QA_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1240,height:850}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/test/fixtures/room3d-pets.html');await page.waitForFunction(()=>window.__pets?.views.length===7);
 await page.setViewportSize({width:1240,height:1180});await page.screenshot({path:'output/pets/gallery.png'});await page.setViewportSize({width:1240,height:850});
 // Every palette renders and every role changes on the actual loaded meshes.
 await page.evaluate(()=>{for(let i=0;i<7;i++){window.__pets.select(i);for(let j=0;j<8;j++)document.querySelectorAll('[data-action="color-preset"]')[j].click();const v=window.__pets.views[i];v.root.traverse(o=>{if(o.isMesh&&'#'+o.material.color.getHexString()!==v.item.materialColors[o.material.name])throw Error('Palette not rendered: '+v.a.id+'/'+o.material.name);});document.querySelector('[data-action="reset-all-colors"]').click();}});
 await page.evaluate(()=>window.__pets.select(3));await page.locator('[data-value="cat-2"]').click();await page.screenshot({path:'output/pets/gallery-blue-cat.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/pets/mobile-gallery.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1100,height:850});
 await page.goto(base+'/test/fixtures/room3d-building.html');await page.waitForFunction(()=>window.__homeEditor);
 const click=(action,extra='')=>page.locator(`[data-action="${action}"]${extra}`).click();
 const state=()=>page.evaluate(()=>window.__homeEditor.getState());
 await click('panel','[data-panel="furniture"]');await click('catalog-mode','[data-value="use"]');await click('category','[data-value="pets"]');
 for(const name of ['bird','snake','slime','cat','dog','turtle','shark'])assert.equal(await page.locator(`[data-action="add-item"][data-id="pet_${name}"]`).count(),1);
 await click('add-item','[data-id="pet_cat"]');let s=await state();const id=s.rooms.flatMap(r=>r.items).find(i=>i.assetId==='pet_cat').id;
 const find=async()=> (await state()).rooms.flatMap(r=>r.items).find(i=>i.id===id);
 await click('palette');await click('color-preset','[data-value="cat-2"]');assert.equal((await find()).materialColors['pet-body'],'#8995a6');
 await page.locator('[data-furniture-color]').fill('#aabbcc');await page.locator('[data-furniture-color]').dispatchEvent('change');assert.equal((await find()).color,'#aabbcc');assert.equal((await find()).materialColors['pet-body'],undefined);
 await page.locator('.h3-part-colors summary').click();await page.locator('[data-material-color="pet-ears"]').fill('#123456');await page.locator('[data-material-color="pet-ears"]').dispatchEvent('change');assert.equal((await find()).materialColors['pet-ears'],'#123456');
 await click('undo');assert.equal((await find()).materialColors['pet-ears'],'#c49caa');await click('redo');assert.equal((await find()).materialColors['pet-ears'],'#123456');
 await page.evaluate(id=>window.__homeEditor.select(id),id);await click('copy');s=await state();const cats=s.rooms.flatMap(r=>r.items).filter(i=>i.assetId==='pet_cat');assert.equal(cats.length,2);assert.deepEqual(cats[0].materialColors,cats[1].materialColors);
 await page.evaluate(id=>window.__homeEditor.select(id),id);await click('palette');
 await page.screenshot({path:'output/pets/installed-colors.png'});
 await page.setViewportSize({width:390,height:667});const rect=await page.locator('.h3-object-bar').boundingBox();assert.ok(rect.y>=0);await page.locator('.h3-part-colors summary').click();await page.locator('[data-material-color="pet-ears"]').scrollIntoViewIfNeeded();await page.screenshot({path:'output/pets/mobile-room-colors.png'});await page.setViewportSize({width:1100,height:850});
 await page.reload();await page.waitForFunction(()=>window.__homeEditor);assert.equal((await find()).materialColors['pet-ears'],'#123456');
 await page.evaluate(id=>window.__homeEditor.select(id),id);await click('palette');await click('reset-all-colors');assert.equal((await find()).materialColors,undefined);assert.equal((await find()).color,null);
 assert.equal((await state()).rooms.flatMap(r=>r.items).find(i=>i.assetId==='pet_cat'&&i.id!==id).materialColors['pet-ears'],'#123456');
 assert.deepEqual(errors,[]);await fs.writeFile('output/pets/browser-qa.json',JSON.stringify({palettes:56,assets:7,customColors:true,undoRedo:true,copyIsolation:true,reload:true,reset:true,mobileOverflow:false,errors},null,2));console.log('Pet gallery and room editor QA passed.');
}finally{await browser.close();}
