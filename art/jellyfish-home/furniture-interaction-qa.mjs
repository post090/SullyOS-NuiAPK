import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:5174/test/fixtures/room3d-showrooms.html?room=bedroom&fresh=1',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
 const state=await p.evaluate(()=>window.__homeEditor.getState()),bed=state.rooms[0].items.find(i=>i.assetId==='show_bed');
 const click=async()=>{const xy=await p.evaluate(id=>window.__homeEditor.projectItem(id),bed.id);await p.mouse.click(xy.x,xy.y);};
 await click();await p.waitForSelector('.h3-interaction-choice');await p.waitForFunction(()=>[...document.querySelectorAll('.h3-interaction-choice')].every(b=>b.getAnimations().every(a=>a.playState==='finished')));await p.screenshot({path:'output/showrooms/furniture-arc-desktop.png'});
 console.log('menu',await p.locator('.h3-interaction').innerText());
 await p.getByRole('button',{name:'睡左边',exact:true}).click();assert.equal(await p.evaluate(()=>window.__homeEditor.inspect().chibiPosture),'lying');
 await click();await p.getByRole('button',{name:'睡右边',exact:true}).click();assert.equal(await p.evaluate(()=>window.__homeEditor.inspect().chibiSeat.seatId),'1');
 await click();await p.getByRole('button',{name:'起身',exact:true}).click();assert.equal(await p.evaluate(()=>window.__homeEditor.inspect().chibiPosture),'standing');
 await click();
 const widthBefore=await p.locator('.h3-interaction').evaluate(el=>el.getBoundingClientRect().width);
 await p.mouse.move(680,430);await p.mouse.wheel(0,240);await p.waitForTimeout(200);
 const widthAfter=await p.locator('.h3-interaction').evaluate(el=>el.getBoundingClientRect().width);assert.ok(widthAfter<widthBefore,'wheel follows projected model size');
 await p.keyboard.press('Escape');assert.equal(await p.locator('.h3-interaction').isVisible(),false);
 await p.locator('[data-panel="chibi"]').click();await p.locator('[data-action="room-view"]').click();
 await click();await p.mouse.move(960,630);await p.mouse.down();await p.mouse.move(1010,650,{steps:5});await p.mouse.up();assert.equal(await p.locator('.h3-interaction').isVisible(),true);
 await p.locator('[data-panel="chibi"]').click();assert.equal(await p.locator('.h3-sheet [data-action="chibi-bed"]').count(),0);await p.locator('[data-action="chibi-motion"][data-value="wave-calm"]').click();assert.equal(await p.evaluate(()=>window.__homeEditor.inspect().chibiMotion),'wave-calm');
 await p.locator('[data-action="close"]').click();await p.locator('[data-action="edit"]').click();await click();assert.equal(await p.evaluate(()=>window.__homeEditor.inspect().selected),bed.id);assert.equal(await p.locator('.h3-interaction').isVisible(),false);
 await p.locator('[data-action="edit"]').click();
 await p.locator('[data-panel="chibi"]').click();await p.locator('[data-action="room-view"]').click();
 const plant=state.rooms[0].items.find(i=>i.assetId==='suite_plant_large');
 const xy=await p.evaluate(i=>window.__homeEditor.projectPoint([i.x,i.y+.2,i.z]),plant);await p.mouse.click(xy.x,xy.y);
 await p.locator('.h3-interaction [data-action="chibi-water"]').click();await p.evaluate(()=>window.advanceTime(700));assert.equal(await p.evaluate(()=>window.__homeEditor.inspect().chibiWatering.itemId),plant.id);
 assert.deepEqual(errors,[]);console.log('desktop passed');await p.close();
 const phone=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(String(e)));
 await phone.goto('http://127.0.0.1:5174/test/fixtures/room3d-showrooms.html?room=bedroom&fresh=1',{waitUntil:'domcontentloaded',timeout:120000});await phone.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
 const target=await phone.evaluate(()=>{const r=window.__homeEditor.getState().rooms[0];return window.__homeEditor.projectItem(r.items.find(i=>i.assetId==='show_bed').id);});await phone.touchscreen.tap(target.x,target.y);
 await phone.waitForSelector('.h3-interaction-choice');await phone.waitForFunction(()=>[...document.querySelectorAll('.h3-interaction-choice')].every(b=>b.getAnimations().every(a=>a.playState==='finished')));await phone.screenshot({path:'output/showrooms/furniture-arc-phone.png'});
 for(const button of await phone.locator('.h3-interaction-choice').all()){const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<750);}
 await phone.getByRole('button',{name:'睡右边',exact:true}).tap();assert.equal(await phone.evaluate(()=>window.__homeEditor.inspect().chibiSeat.seatId),'1');
 // A narrow landscape menu pages rather than clipping the lower actions.
 await phone.setViewportSize({width:844,height:390});
 await phone.waitForFunction(()=>document.querySelector('.h3-stage canvas').width===Math.floor(844*window.__homeEditor.inspect().pixelRatio));
 const landscape=await phone.evaluate(()=>{const r=window.__homeEditor.getState().rooms[0];return window.__homeEditor.projectItem(r.items.find(i=>i.assetId==='show_bed').id);});
 await phone.touchscreen.tap(landscape.x,landscape.y);await phone.waitForSelector('.h3-interaction-choice');
 assert.equal(await phone.locator('.h3-interaction-choice').count(),1);await phone.locator('[data-action="interaction-more"]').tap();assert.equal((await phone.locator('.h3-interaction-choice span').innerText()),'睡右边');
 await phone.screenshot({path:'output/showrooms/furniture-arc-landscape.png'});
 assert.deepEqual(errors,[]);await fs.writeFile('output/showrooms/furniture-interaction-qa.json',JSON.stringify({desktop:true,phone:true,bedSides:true,stand:true,escape:true,drag:true,edit:true,errors},null,2));console.log('phone passed');
}finally{await b.close();}
