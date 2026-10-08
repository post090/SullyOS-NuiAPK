import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await mkdir('output/room-topology',{recursive:true});
try{
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-topology.html');await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 const inspect=()=>page.evaluate(()=>window.__homeEditor.inspect()),click=(a,extra='')=>page.locator(`[data-action="${a}"]${extra}`).click();
 const shot=async name=>{await page.evaluate(()=>window.advanceTime(0));await page.screenshot({path:`output/room-topology/${name}.png`});};
 let s=await inspect();console.log('READY',s.headWidth,s.chibiVisible,s.chibiPosition);assert.equal(s.chibiVisible,true);
 for(const view of ['cutaway','dollhouse','hidden']){await click('wall-view',`[data-value="${view}"]`);assert.equal((await inspect()).wallView,view);await shot(view);}
 await click('wall-view','[data-value="cutaway"]');
 // A real click on the floor starts locomotion, not a teleport or camera drag.
 const target=await page.evaluate(()=>{const p=window.__homeEditor.projectPoint([-1.5,.18,-.5]),r=document.querySelector('.h3-stage').getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};});
 await page.mouse.click(target.x,target.y);assert.equal((await inspect()).walking,true);await page.evaluate(()=>window.advanceTime(9000));assert.ok(Math.abs((await inspect()).chibiPosition[0]+1.5)<.01);
 // Remove starter furniture through the real UI for a clear passage test.
 for(const i of s.rooms[0].items){await page.evaluate(id=>window.__homeEditor.select(id),i.id);await click('store');}
 const first=s.activeRoomId;
 await click('panel','[data-panel="building"]');await click('boundary-edge','[data-value="front"]');await click('boundary-door','[data-value="door"]');
 assert.equal((await inspect()).rooms[0].boundaries.front.door.kind,'door');await shot('door-controls');
 await click('panel','[data-panel="chibi"]');await click('chibi-door','[data-edge="front"]');s=await inspect();assert.equal(s.walking,true,s.message);
 await page.evaluate(()=>window.advanceTime(1400));await shot('door-opening');await page.evaluate(()=>window.advanceTime(9000));s=await inspect();assert.equal(s.walking,false);assert.ok(s.chibiPosition[2]>3.975);await shot('outside');
 await click('panel','[data-panel="chibi"]');await click('chibi-door','[data-edge="front"]');await page.evaluate(()=>window.advanceTime(9000));assert.ok((await inspect()).chibiPosition[2]<3.975);
 // Sliding doors preserve width/offset, open on approach and permit a return trip.
 await click('panel','[data-panel="building"]');await click('boundary-edge','[data-value="right"]');await click('boundary-door','[data-value="sliding"]');await click('door-width','[data-delta=".2"]');await click('door-offset','[data-delta=".2"]');
 assert.equal((await inspect()).rooms[0].boundaries.right.door.at,.2);await click('wall-view','[data-value="dollhouse"]');await click('close');await shot('sliding-door');
 await click('panel','[data-panel="chibi"]');await click('chibi-door','[data-edge="right"]');assert.equal((await inspect()).walking,true);await page.evaluate(()=>window.advanceTime(9000));s=await inspect();assert.ok(s.chibiPosition[0]>4.65);assert.ok(s.doorStates.find(d=>d.kind==='sliding').x>2);await shot('sliding-open');
 await click('panel','[data-panel="chibi"]');await click('chibi-door','[data-edge="right"]');await page.evaluate(()=>window.advanceTime(9000));assert.ok((await inspect()).chibiPosition[0]<4.65);await click('wall-view','[data-value="cutaway"]');
 // Create two rooms and a shared arch. Doors separate rooms but permit walking.
 await click('panel','[data-panel="expand"]');await click('expand','[data-direction="right"]');s=await inspect();const second=s.activeRoomId;
 await click('panel','[data-panel="building"]');await click('boundary-edge','[data-value="left"]');await click('boundary-door','[data-value="arch"]');s=await inspect();assert.equal(s.visibleRoomIds.length,2);assert.equal(s.roomGroups.length,2);await click('close');await shot('arch-between-rooms');
 await click('panel','[data-panel="chibi"]');await click('chibi-door',`[data-room="${second}"][data-edge="left"]`);assert.equal((await inspect()).walking,true);await page.evaluate(()=>window.advanceTime(15000));s=await inspect();assert.ok(s.visitorLocation.x<4.65);await shot('through-arch');
 await click('panel','[data-panel="building"]');await click('boundary-kind','[data-value="open"]');s=await inspect();assert.equal(s.roomGroups.length,1);await click('close');await shot('merged');
 await click('undo');assert.equal((await inspect()).roomGroups.length,2);await click('redo');assert.equal((await inspect()).roomGroups.length,1);
 await click('panel','[data-panel="building"]');await click('boundary-kind','[data-value="wall_fence"]');assert.equal((await inspect()).roomGroups.length,2);
 await click('boundary-kind','[data-value="open"]');await click('close');
 // Place a table, then move it across the former boundary using keyboard nudges.
 await click('panel','[data-panel="furniture"]');await click('category','[data-value="table"]');await click('add-item','[data-id="table"]');s=await inspect();const table=s.selected;
 await page.locator('#home').focus();for(let i=0;i<Math.ceil((s.rooms.find(r=>r.id===second).items.find(i=>i.id===table).x+5.5)/.2);i++)await page.keyboard.press('ArrowLeft');s=await inspect();assert.ok(s.rooms.find(r=>r.id===first).items.some(i=>i.id===table&&!i.stored),'table migrates across the seam');
 // At the seam, reconstructing a wall must fail without writing a broken layout.
 await page.evaluate(id=>window.__homeEditor.select(id),table);s=await inspect();const owner=s.rooms.find(r=>r.id===s.activeRoomId),item=owner.items.find(i=>i.id===table);
 const delta=owner.id===first?4.65-item.x:-4.65-item.x;await page.locator('#home').focus();for(let i=0;i<Math.round(Math.abs(delta)/.2);i++)await page.keyboard.press(delta>0?'ArrowRight':'ArrowLeft');
 await click('panel','[data-panel="building"]');await click('boundary-edge',`[data-value="${owner.id===first?'right':'left'}"]`);await click('boundary-kind','[data-value="wall_high"]');s=await inspect();assert.equal(s.roomGroups.length,1);assert.match(s.message,/挪开/);
 await shot('blocked-rebuild');await click('close');
 const saved=(await inspect()).rooms;await page.reload();await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});assert.deepEqual((await inspect()).rooms,saved);assert.equal((await inspect()).roomGroups.length,1);
 await page.setViewportSize({width:360,height:780});await click('panel','[data-panel="furniture"]');await click('category','[data-value="doors"]');await shot('mobile-door-category');
 assert.equal(await page.locator('.h3-dock').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 const state=await inspect();await writeFile('output/room-topology/result.json',JSON.stringify({errors,checks:'views/exterior-entry/arch-travel/merge/split/undo/redo/furniture-crossing/collision/reload/mobile',state},null,2));assert.deepEqual(errors,[]);console.log('TOPOLOGY_QA_PASS',state.drawCalls);
}catch(e){await page.screenshot({path:'output/room-topology/failure.png'});console.log(await page.evaluate(()=>window.__homeEditor?.inspect()));throw e;}finally{await browser.close();}
