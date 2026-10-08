import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
await fs.mkdir('output/gaming-room/twin',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-gaming.html?kind=rhythm');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
 await page.evaluate(()=>window.advanceTime(0)); // Freeze wall-clock animation before choosing a station.
 const click=(action,query='')=>page.locator(`[data-action="${action}"]${query}`).click();
 const handState=()=>page.evaluate(()=>{const hands=[];window.__visitor.root.traverse(o=>{if(o.name.startsWith('chibi-hand-'))hands.push({name:o.name,position:o.position.toArray(),scale:o.scale.toArray(),geometry:Array.from(o.geometry.attributes.position.array),body:o.parent.position.toArray()});});return hands;});
 const rest=await handState();
 for(const station of ['left','right']){
  await click('panel','[data-panel="chibi"]');await click('chibi-game',`[data-station="${station}"]`);
  await page.evaluate(()=>window.advanceTime(5100));const apex=await handState();
  const state=await page.evaluate(()=>window.__homeEditor.inspect());assert.equal(state.chibiActivity.stationId,station);
  for(const [i,h]of apex.entries()){assert.deepEqual(h.geometry,rest[i].geometry);assert.deepEqual(h.scale,rest[i].scale);assert.ok(h.body[1]>1.9);}
  await click('panel','[data-panel="chibi"]');await click('chibi-view');await click('wall-view','[data-value="hidden"]');
  await page.screenshot({path:`output/gaming-room/twin/${station}-high.png`});
  if(station==='left'){await click('turn-view','[data-angle="-.785398"]');await click('turn-view','[data-angle="-.785398"]');await page.screenshot({path:'output/gaming-room/twin/side-high.png'});}
  await page.evaluate(()=>window.advanceTime(750));for(const h of await handState())assert.ok(Math.abs(h.body[1])<1e-8);
  await page.screenshot({path:`output/gaming-room/twin/${station}-landed.png`});
  await click('panel','[data-panel="chibi"]');await click('chibi-game-stop');for(const h of await handState())assert.deepEqual(h.body,[0,0,0]);await click('close');
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
 await click('panel','[data-panel="chibi"]');await click('chibi-game','[data-station="left"]');await page.evaluate(()=>window.advanceTime(5100));for(const h of await handState())assert.deepEqual(h.body,[0,0,0]);
 assert.deepEqual(errors,[]);console.log('Both stations: high jump, rigid hands, landing, stop, reduced motion passed; no browser errors.');
}finally{await browser.close();}
