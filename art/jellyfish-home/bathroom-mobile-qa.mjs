import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:5174/test/fixtures/room3d-bathroom.html');await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});
 const state=()=>p.evaluate(()=>window.__homeEditor.inspect()),act=(a,q='')=>p.locator('[data-action="'+a+'"]'+q).first().click();
 await p.evaluate(()=>window.__homeEditor.select('bath_washer'));await act('palette');await p.locator('[data-furniture-color]').fill('#e1adb9');await p.locator('[data-furniture-color]').dispatchEvent('change');
 assert.equal((await state()).rooms[0].items.find(i=>i.id==='bath_washer').color,'#e1adb9');await p.screenshot({path:'output/bathroom/mobile-color.png'});
 await act('undo');assert.equal((await state()).rooms[0].items.find(i=>i.id==='bath_washer').color,null);await act('redo');assert.equal((await state()).rooms[0].items.find(i=>i.id==='bath_washer').color,'#e1adb9');
 await p.evaluate(()=>window.__homeEditor.select('bath_washer'));await act('palette');await act('color','[data-value=""]');assert.equal((await state()).rooms[0].items.find(i=>i.id==='bath_washer').color,null);
 await act('deselect');await p.screenshot({path:'output/bathroom/mobile-room.png'});assert.deepEqual(errors,[]);await fs.writeFile('output/bathroom/mobile-report.json',JSON.stringify({customColor:true,undoRedoReset:true,errors}));console.log('Mobile bathroom color, history and reset passed');
}finally{await browser.close();}
