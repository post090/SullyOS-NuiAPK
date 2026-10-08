import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/tiaotiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/@vite/client', route=>route.fulfill({contentType:'application/javascript',body:`export function createHotContext(){return {on(){},off(){},accept(){},dispose(){},prune(){},invalidate(){},data:{}}} const sheets=new Map();export function updateStyle(id,css){let e=sheets.get(id);if(!e){e=document.createElement('style');document.head.append(e);sheets.set(id,e);}e.textContent=css;}export function removeStyle(id){sheets.get(id)?.remove();sheets.delete(id);}export function injectQuery(url){return url;}`}));
 await page.goto('http://127.0.0.1:5174/test/fixtures/home-pets.html');await page.waitForFunction(()=>window.__homeEditor,{timeout:120000});
 await page.locator('.h3-pets-entry').click();assert.equal(await page.locator('.pet-card img').count(),7);
 assert.equal(await page.locator('.pet-card img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
 await page.locator('[data-pet-action=tab][data-tab=supplies]').click();await page.locator('[data-pet-action=refill]').first().click();assert.equal(await page.locator('.pet-food-dots').first().locator('[data-filled=true]').count(),5);
 await page.locator('[data-pet-action=tab][data-tab=pets]').click();await page.locator('[data-pet-action=select]').last().click();
 await page.locator('[data-kind=play]').click();await page.screenshot({path:'output/pets/life/mobile-care.png'});
 await page.evaluate(()=>window.advanceTime(6100));await page.waitForFunction(()=>document.querySelector('[data-pet-feedback]')?.textContent.includes('完成'));
 await page.locator('[data-pet-action=detail-tab][data-tab=journal]').click();assert.match(await page.locator('.pet-journal').textContent(),/和你玩了一会儿/);
 await page.locator('[data-pet-action=detail-tab][data-tab=care]').click();await page.locator('[data-kind=feed]').click();await page.evaluate(()=>window.__homeEditor.getPetSystem().life.runtime.clear());await page.waitForFunction(()=>document.querySelector('[data-pet-feedback]')?.textContent.includes('停下'));
 await page.locator('[data-kind=rest]').click();await page.evaluate(()=>window.__homeEditor.setSuspended(true));await page.waitForFunction(()=>document.querySelector('[data-pet-feedback]')?.textContent.includes('暂停'));assert.equal(await page.locator('.pet-stage').getAttribute('data-pet-motion'),'idle');
 const progress=await page.locator('[data-action-progress]').getAttribute('value');await page.evaluate(()=>window.advanceTime(20000));assert.equal(await page.locator('[data-action-progress]').getAttribute('value'),progress);
 await page.evaluate(()=>window.__homeEditor.setSuspended(false));await page.evaluate(()=>window.advanceTime(18100));await page.waitForFunction(()=>document.querySelector('[data-pet-feedback]')?.textContent.includes('完成'));
 assert.equal(await page.evaluate(()=>document.querySelector('.h3-pets-sheet').scrollWidth>document.querySelector('.h3-pets-sheet').clientWidth),false);
 await page.screenshot({path:'output/pets/life/mobile-care-complete.png'});assert.deepEqual(errors,[]);console.log('Pet panel QA passed: portraits, supplies, play, journal, cancellation, pause, rest, mobile.');
}finally{await browser.close();}

