import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});const errors=[];await fs.mkdir('output/loft-guard',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1.5});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.addInitScript(()=>localStorage.setItem('sully-home3d-quality','clear'));
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-loft.html?rotation=180');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 const click=(a,q='')=>page.locator(`[data-action="${a}"]${q}`).click(),inspect=()=>page.evaluate(()=>window.__homeEditor.inspect());
 await click('wall-view','[data-value="hidden"]');await page.screenshot({path:'output/loft-guard/back-no-walls.png'});const initial=await inspect();assert.equal(initial.rooms[0].items[0].rotation,180);
 await page.evaluate(()=>window.__homeEditor.select('loft-test'));await click('store');assert.equal((await inspect()).rooms[0].items[0].stored,true);await click('undo');assert.equal((await inspect()).rooms[0].items[0].stored,false);await click('edit');
 await click('turn-view','[data-angle=".785398"]');await click('turn-view','[data-angle=".785398"]');await page.screenshot({path:'output/loft-guard/stair-side.png'});
 assert.deepEqual(errors,[]);console.log('Loft backside, stair opening, hidden walls and storage/undo checked without browser errors');
}finally{await browser.close();}
