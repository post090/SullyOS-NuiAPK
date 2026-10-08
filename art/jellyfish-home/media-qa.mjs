import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {placementError,moveFurniture,validateHome} from '../../apps/room3d/model.js';
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8'));
for(const id of ['wooden_window','media_cabinet','small_television','little_console','little_controller']){
 const bytes=await fs.readFile(`public/room3d/${id}.glb`),j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.equal(j.images?.length??0,0);assert.equal(j.textures?.length??0,0);let triangles=0;
 for(const m of j.meshes)for(const p of m.primitives){assert.equal(p.attributes.TEXCOORD_0,undefined);triangles+=j.accessors[p.indices].count/3;}assert.ok(triangles<6000);assert.ok(bytes.length<160000);
 for(const name of catalog.find(a=>a.id===id).paintMaterials)assert.ok(j.materials.some(m=>m.name===name));
 const wood=j.materials.find(m=>m.name==='woodLight');if(wood)assert.ok(Math.abs(wood.pbrMetallicRoughness.baseColorFactor[0]-.8227857351)<1e-5);
}
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await fs.mkdir('output/media',{recursive:true});await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-media.html');await page.waitForFunction(()=>window.__homeEditor);
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,extra='')=>page.locator(`[data-action="${a}"]${extra}`).click(),select=id=>page.evaluate(id=>window.__homeEditor.select(id),id);
 const initial=await inspect(),r=initial.rooms[0];for(const i of r.items)assert.equal(placementError(i,r,catalog),'');await page.screenshot({path:'output/media/room.png'});
 const rotated=structuredClone(r);moveFurniture(rotated,'media_cabinet',{rotation:90,x:.2},catalog);for(const i of rotated.items)assert.equal(placementError(i,rotated,catalog),'');
 await select('media_cabinet');await click('rotate');await click('place-rotation');assert.equal((await inspect()).rooms[0].items.find(i=>i.id==='small_television').rotation,90);await click('undo');await click('redo');await click('undo');
 await select('media_cabinet');await click('palette');await click('color','[data-value="#91C9F4"]');await click('store');let state=await inspect();for(const i of state.rooms[0].items.filter(i=>i.id==='media_cabinet'||i.supportId==='media_cabinet'))assert.ok(i.stored);await click('undo');
 await select('small_television');await click('store');state=await inspect();assert.ok(state.rooms[0].items.find(i=>i.id==='small_television').stored);assert.ok(!state.rooms[0].items.find(i=>i.id==='little_console').stored);await click('undo');
 for(const id of ['wooden_window','left-window']){await select(id);await click('store');assert.ok((await inspect()).rooms[0].items.find(i=>i.id===id).stored);await click('undo');}
 await click('panel','[data-panel="furniture"]');for(const [category,ids]of [['table',['media_cabinet']],['tabletop',['small_television','little_console','little_controller']],['wall',['wooden_window']]]){await click('category',`[data-value="${category}"]`);for(const id of ids)assert.equal(await page.locator(`[data-action="add-item"][data-id="${id}"]`).count(),1);}
 const saved=await inspect();assert.doesNotThrow(()=>validateHome({version:1,assetVersion:2,activeRoomId:saved.activeRoomId,rooms:saved.rooms},catalog));assert.deepEqual(errors,[]);console.log('MEDIA_PASS: texture-free budgets, wood, category, valid supports, rotate/follow, repaint, independent storage, undo/redo, serializable layout.');
}finally{await browser.close();}
