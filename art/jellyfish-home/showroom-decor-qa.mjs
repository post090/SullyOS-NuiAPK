import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']}),p=await b.newPage({viewport:{width:1200,height:900}}),errors=[];
p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto('http://127.0.0.1:5174/test/fixtures/room3d-showrooms.html?room=bedroom');await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});
const state=()=>p.evaluate(()=>window.__homeEditor.getState()),inspect=()=>p.evaluate(()=>window.__homeEditor.inspect()),act=(a,q='')=>p.locator('[data-action="'+a+'"]'+q).first().click(),panel=async n=>{if((await inspect()).panel!==n)await act('panel','[data-panel="'+n+'"]');};
const room=(await state()).rooms[0],bed=room.items.find(i=>i.assetId==='show_bed');await p.evaluate(id=>window.__homeEditor.select(id),bed.id);await act('palette');
for(const [name,color]of [['pillow-left','#91c9f4'],['pillow-right','#f2b8d5']]){const input=p.locator('[data-material-color="'+name+'"]');await input.fill(color);await input.dispatchEvent('change');}
assert.deepEqual((await state()).rooms[0].items.find(i=>i.id===bed.id).materialColors,{'pillow-left':'#91c9f4','pillow-right':'#f2b8d5'});
await act('undo');assert.equal((await state()).rooms[0].items.find(i=>i.id===bed.id).materialColors['pillow-right'],bed.materialColors['pillow-right']);await act('redo');
await p.screenshot({path:'output/showrooms/cushion-colors.png'});if(await p.locator('[data-action="deselect"]').count())await act('deselect');
const before=await state();await panel('room-style');await act('room-style-preset','[data-value="spa"]');let after=await state();assert.equal(after.rooms[0].wallStyle,'spa');assert.deepEqual(after.rooms[0].items,before.rooms[0].items);await act('undo');assert.deepEqual(await state(),before);await act('redo');assert.equal((await state()).rooms[0].wallStyle,'spa');await act('undo');if(await p.locator('[data-action="close"]').count())await act('close');
// Actual editor movement must retain the tabletop owner and relative offset.
const dresser=room.items.find(i=>i.assetId==='show_bedroom_dresser'),props=room.items.filter(i=>i.supportId===dresser.id);await p.evaluate(id=>window.__homeEditor.select(id),dresser.id);
const projected=await p.evaluate(id=>window.__homeEditor.projectItem(id),dresser.id);assert.ok(projected);await p.screenshot({path:'output/showrooms/decor-selected.png'});
await act('store');after=await state();assert.equal(after.rooms[0].items.find(i=>i.id===dresser.id).stored,true);for(const prop of props)assert.equal(after.rooms[0].items.find(i=>i.id===prop.id).stored,true);await act('undo');assert.equal((await state()).rooms[0].items.find(i=>i.id===dresser.id).stored,false);
const saved=await state();await p.reload();await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:120000});assert.deepEqual(await state(),saved);
const bedPoint=await p.evaluate(id=>window.__homeEditor.projectItem(id),bed.id);await p.mouse.click(bedPoint.x,bedPoint.y);await act('chibi-bed');await p.evaluate(()=>window.advanceTime(500));assert.equal((await inspect()).chibiPosture,'lying');await panel('chibi');await act('chibi-view');await p.evaluate(()=>window.advanceTime(0));await p.screenshot({path:'output/showrooms/bedroom-decor-pose.png'});
assert.deepEqual(errors,[]);await fs.writeFile('output/showrooms/decor-qa.json',JSON.stringify({colors:true,undoRedo:true,stylesPreserveFurniture:true,supportStorage:true,persistence:true,lying:true,errors},null,2));await b.close();
