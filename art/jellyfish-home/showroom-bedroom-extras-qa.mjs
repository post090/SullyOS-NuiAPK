import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.addInitScript(()=>localStorage.setItem('sully-home3d-quality','clear'));
 await p.goto('http://127.0.0.1:5174/test/fixtures/room3d-showrooms.html?room=bedroom&fresh=1');await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
 await p.evaluate(()=>window.advanceTime(0));await p.screenshot({path:'output/showrooms/bedroom-extras-final.png'});
 const state=await p.evaluate(()=>window.__homeEditor.getState()),r=state.rooms[0],plant=r.items.find(i=>i.assetId==='suite_plant_large'),dresser=r.items.find(i=>i.assetId==='show_bedroom_dresser'),mirror=r.items.find(i=>i.assetId==='suite_dressing_mirror');
 assert.equal(r.items.length,15);assert.equal(mirror.supportId,dresser.id);
 const plantPoint=await p.evaluate(i=>window.__homeEditor.projectPoint([i.x,i.y+.2,i.z]),plant);await p.mouse.click(plantPoint.x,plantPoint.y);await p.locator('[data-action="chibi-water"][data-id="'+plant.id+'"]').click();
 await p.evaluate(()=>window.advanceTime(700));const watering=await p.evaluate(()=>window.__homeEditor.inspect());assert.equal(watering.chibiMotion,'water');assert.equal(watering.chibiWatering.itemId,plant.id);assert.equal(watering.wateringVisible,true);
 await p.screenshot({path:'output/showrooms/bedroom-plant-watering.png'});
 await p.evaluate(id=>window.__homeEditor.select(id),dresser.id);await p.locator('[data-action="store"]').click();
 let saved=await p.evaluate(()=>window.__homeEditor.getState());assert.equal(saved.rooms[0].items.find(i=>i.id===mirror.id).stored,true);
 await p.locator('[data-action="undo"]').click();await p.locator('[data-action="redo"]').click();await p.locator('[data-action="undo"]').click();
 saved=await p.evaluate(()=>window.__homeEditor.getState());assert.equal(saved.rooms[0].items.find(i=>i.id===mirror.id).stored,false);
 await p.reload();await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});assert.deepEqual(await p.evaluate(()=>window.__homeEditor.getState()),saved);assert.deepEqual(errors,[]);
 await fs.writeFile('output/showrooms/bedroom-extras-qa.json',JSON.stringify({items:15,watering:true,mirrorSupport:true,storageUndoRedo:true,reload:true,errors},null,2));console.log('Bedroom extras QA passed');
}finally{await b.close();}
