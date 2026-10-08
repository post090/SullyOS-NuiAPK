import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {readGeometry,splitParts} from './asset-geometry.mjs';
// Smoothing must not reopen or detach any of the five imported table legs.
const [legs,slab]=await readGeometry('public/room3d/daisy_table.glb'),legEdges=new Map();
for(let i=0;i<legs.index.count;i+=3){const t=[0,1,2].map(k=>legs.index.getX(i+k));for(let k=0;k<3;k++){const key=[t[k],t[(k+1)%3]].sort((a,b)=>a-b).join(',');legEdges.set(key,(legEdges.get(key)||0)+1);}}
assert.ok([...legEdges.values()].every(n=>n===2),'table legs must be closed');slab.computeBoundingBox();const legParts=splitParts(legs);assert.equal(legParts.length,5);for(const p of legParts)assert.ok(p.box.max.y>slab.boundingBox.min.y+.05,'each leg must extend into the slab');
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'playwright');
for(const id of ['monstera','daisy_table','daisy_vase','daisy_books','daisy_mug','daisy_cookies']){const b=await fs.readFile(`public/room3d/${id}.glb`),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.equal(j.images?.length??0,0);assert.equal(j.textures?.length??0,0);let triangles=0;for(const m of j.meshes)for(const p of m.primitives){assert.ok(!p.attributes.TEXCOORD_0);triangles+=j.accessors[p.indices].count/3;}assert.ok(triangles<6000);assert.ok(b.length<160000);}
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await fs.mkdir('output/botanical',{recursive:true});
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-botanical.html');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:60000});
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,extra='')=>page.locator(`[data-action="${a}"]${extra}`).click();
 assert.equal((await inspect()).rooms[0].items.filter(i=>i.supportId==='daisy_table').length,4);
 await page.screenshot({path:'output/botanical/room.png'});
 await click('panel','[data-panel="chibi"]');await click('chibi-water');await page.evaluate(()=>window.advanceTime(1100));let s=await inspect();assert.equal(s.chibiMotion,'water');assert.ok(s.wateringVisible);assert.ok(s.chibiWatering.spot);assert.equal(s.chibiSeat,null);
 await click('panel','[data-panel="chibi"]');await click('chibi-view');await page.screenshot({path:'output/botanical/watering.png'});
 const hands=await page.evaluate(()=>{let h=[];window.__visitor.root.traverse(o=>{if(o.name.startsWith('chibi-hand-'))h.push({scale:o.scale.toArray(),p:Array.from(o.geometry.attributes.position.array)});});return h;});
 await page.evaluate(()=>window.advanceTime(4000));s=await inspect();assert.equal(s.chibiMotion,'idle');assert.equal(s.chibiWatering,null);assert.equal(s.wateringVisible,false);
 await page.evaluate(()=>window.__visitor.animate(0,'idle'));const rest=await page.evaluate(()=>{let h=[];window.__visitor.root.traverse(o=>{if(o.name.startsWith('chibi-hand-'))h.push({scale:o.scale.toArray(),p:Array.from(o.geometry.attributes.position.array)});});return h;});assert.deepEqual(hands,rest);
 // Repeat the interaction to check no geometry/texture growth.
 const before=await inspect();for(let i=0;i<3;i++){await click('panel','[data-panel="chibi"]');await click('chibi-water');await page.evaluate(()=>window.advanceTime(5000));}const after=await inspect();assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);
 await click('panel','[data-panel="chibi"]');await click('chibi-water');await page.evaluate(()=>window.advanceTime(900));
 await page.evaluate(()=>window.__homeEditor.select('monstera'));await click('store');assert.equal((await inspect()).chibiWatering,null);assert.equal((await inspect()).wateringVisible,false);
 await click('undo');assert.ok((await inspect()).rooms[0].items.some(i=>i.id==='monstera'&&!i.stored));
 assert.deepEqual(errors,[]);console.log('Botanical assets, supports, watering lifecycle, rigid hands and GPU reuse passed.');
}finally{await browser.close();}
