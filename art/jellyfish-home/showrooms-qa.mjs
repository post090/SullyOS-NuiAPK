import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});await fs.mkdir('output/showrooms',{recursive:true});const errors=[];
const p=await browser.newPage({viewport:{width:1200,height:900}});p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto('http://127.0.0.1:5174/test/fixtures/room3d-showrooms.html?empty');await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
const state=()=>p.evaluate(()=>window.__homeEditor.inspect()),act=async(action,selector='')=>p.locator('[data-action="'+action+'"]'+selector).first().click(),panel=async name=>{if((await state()).panel!==name)await act('panel','[data-panel="'+name+'"]');};
await panel('quality');await act('quality','[data-value="balanced"]');await act('close');
const snapshots=[];
for(const key of ['spa','study','kitchen','living','bedroom']){
 const before=await p.evaluate(()=>window.__homeEditor.getState());await panel('rooms');await act('showroom','[data-value="'+key+'"]');let s=await state();assert.equal(s.rooms.length,before.rooms.length+1,s.message);const id=s.activeRoomId;await act('undo');assert.deepEqual(await p.evaluate(()=>window.__homeEditor.getState()),before);await act('redo');assert.equal((await state()).activeRoomId,id);
 await panel('rooms');await act('room-scope','[data-value="room"]');await act('close');await p.evaluate(()=>window.advanceTime(500));await p.screenshot({path:'output/showrooms/room-'+key+'.png'});
 if(key==='living'||key==='spa'){
  await panel('chibi');await act('chibi-sit');await p.evaluate(()=>window.advanceTime(600));assert.equal((await state()).chibiPosture,'seated');await panel('chibi');await act('chibi-view');await p.screenshot({path:'output/showrooms/sit-'+key+'.png'});await panel('chibi');await act('chibi-stand');await panel('chibi');await act('room-view');
 }
 s=await state();snapshots.push({key,rooms:s.rooms.length,triangles:s.triangles,drawCalls:s.drawCalls,message:s.message});console.log(key,snapshots.at(-1));
}
const saved=await p.evaluate(()=>window.__homeEditor.getState());await p.reload();await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});assert.deepEqual(await p.evaluate(()=>window.__homeEditor.getState()),saved);
await p.setViewportSize({width:390,height:844});await panel('rooms');await p.screenshot({path:'output/showrooms/mobile-room-panel.png'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);await fs.writeFile('output/showrooms/qa.json',JSON.stringify({snapshots,errors,saved:true,undoRedo:true},null,2));await browser.close();
