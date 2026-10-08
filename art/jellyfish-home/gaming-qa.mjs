import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),assets=catalog.filter(a=>a.collection==='gaming');let total=0,triangles=0;
for(const a of assets){const b=await fs.readFile('public/room3d/'+a.url),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.ok(!j.images?.length&&!j.textures?.length);assert.ok(b.length<200000,a.id);let t=0;for(const m of j.meshes)for(const p of m.primitives){assert.ok(!p.attributes.TEXCOORD_0&&!p.attributes.COLOR_0);t+=j.accessors[p.indices].count/3;}assert.ok(t<6000,a.id+' '+t);total+=b.length;triangles+=t;}
console.log('20 assets:',total,'bytes,',triangles,'triangles');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});const errors=[];
try{
 for(const kind of ['computer','stream','race','rhythm']){
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-gaming.html?kind='+kind);await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
  const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).first().click();
  const handState=()=>page.evaluate(()=>{const hands=[];window.__visitor.root.traverse(o=>{if(o.name.startsWith('chibi-hand-'))hands.push({name:o.name,position:o.position.toArray(),scale:o.scale.toArray(),geometry:Array.from(o.geometry.attributes.position.array)});});return hands;});
  const rest=await handState();await click('panel','[data-panel="chibi"]');await click('chibi-game',`[data-kind="${kind}"]`);await page.evaluate(()=>window.advanceTime(700));const first=await handState();await page.evaluate(()=>window.advanceTime(330));const second=await handState();
  assert.ok(first.some((h,i)=>JSON.stringify(h.position)!==JSON.stringify(second[i].position)));for(let i=0;i<rest.length;i++){assert.deepEqual(rest[i].geometry,second[i].geometry);assert.deepEqual(rest[i].scale,second[i].scale);}
  assert.equal((await inspect()).chibiMotion,kind);assert.equal((await inspect()).chibiPosture,kind==='rhythm'?'standing':'seated');
  await click('panel','[data-panel="chibi"]');await click('chibi-view');await click('wall-view','[data-value="hidden"]');await click('turn-view','[data-angle=".785398"]');await click('turn-view','[data-angle=".785398"]');await page.screenshot({path:`output/gaming-room/${kind}-side.png`});
  const resource=await inspect();await page.evaluate(()=>window.advanceTime(12500));assert.equal((await inspect()).chibiActivity,null);assert.equal((await inspect()).chibiMotion,'idle');
  for(let i=0;i<3;i++){await click('panel','[data-panel="chibi"]');await click('chibi-game',`[data-kind="${kind}"]`);await page.evaluate(()=>window.advanceTime(650));await click('panel','[data-panel="chibi"]');await click('chibi-game-stop');await click('close');}
  const after=await inspect();assert.equal(after.geometries,resource.geometries);assert.equal(after.textures,resource.textures);
  // Emotes end the device action but retain the reviewed sitting posture.
  await click('panel','[data-panel="chibi"]');await click('chibi-game',`[data-kind="${kind}"]`);await click('panel','[data-panel="chibi"]');await click('chibi-motion','[data-value="wave-cute"]');assert.equal((await inspect()).chibiActivity,null);assert.equal((await inspect()).chibiPosture,kind==='rhythm'?'standing':'seated');
  await click('chibi-game',`[data-kind="${kind}"]`);const active=(await inspect()).chibiActivity;await page.evaluate(id=>window.__homeEditor.select(id),active.itemId);await click('store');assert.equal((await inspect()).chibiActivity,null);await click('undo');assert.ok((await inspect()).rooms[0].items.some(i=>i.id===active.itemId&&!i.stored));
  await page.close();console.log(kind,'animation, contact, stop, emote, storage, undo, resource reuse passed');
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-gaming.html?kind=empty');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 await page.locator('[data-panel="furniture"]').click();await page.locator('[data-action="category"][data-value="gaming"]').click();assert.equal(await page.locator('.h3-asset').count(),20);await page.screenshot({path:'output/gaming-room/mobile-shelf.png'});
 await page.locator('[data-action="gaming-preset"][data-kind="stream"]').click();let s=await page.evaluate(()=>window.__homeEditor.inspect());assert.equal(s.rooms[0].items.length,7);assert.equal(s.undoCount,1);await page.locator('[data-action="undo"]').click();assert.equal((await page.evaluate(()=>window.__homeEditor.inspect())).rooms[0].items.length,0);await page.locator('[data-action="redo"]').click();assert.equal((await page.evaluate(()=>window.__homeEditor.inspect())).rooms[0].items.length,7);
 await page.locator('[data-panel="chibi"]').click();assert.equal(await page.locator('[data-action="chibi-game"][data-kind="stream"]').isEnabled(),true);await page.screenshot({path:'output/gaming-room/mobile-actions.png'});await page.close();
 assert.deepEqual(errors,[]);console.log('Mobile shelf, presets, undo/redo passed; no browser errors.');
}finally{await browser.close();}
