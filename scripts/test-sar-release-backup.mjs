import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='output/sar-release-backup';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),base=process.env.SAR_QA_URL||'http://127.0.0.1:5173';
const errors=[],results=[];
const open=async()=>{
    const context=await browser.newContext();
    await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/test/fixtures/sar-release.html?backup`);
    await page.waitForFunction(()=>window.releaseQA?.characters.length>0);
    return {page,context};
};
const snapshot=page=>page.evaluate(async()=>{const {readSARBackup}=await import('/test/fixtures/sar-backup-data.ts');return JSON.parse(JSON.stringify(await readSARBackup()));});
try{
    const source=await open();
    await source.page.evaluate(async()=>{const {seedSARBackup}=await import('/test/fixtures/sar-backup-data.ts');await seedSARBackup(window.releaseQA);});
    await source.page.reload();
    await source.page.waitForFunction(()=>window.releaseQA?.characters.some(c=>c.id==='qa-sar-backup'));
    const expected=await snapshot(source.page);
    assert(expected.photoBytes?.length>0);assert.deepEqual(expected.photoBytes,expected.legacyBytes);
    for(const mode of ['full','text_only','media_only']){
        const bytes=await source.page.evaluate(async mode=>Array.from(new Uint8Array(await (await window.releaseQA.exportSystem(mode)).arrayBuffer())),mode);
        writeFileSync(`${out}/${mode}.zip`,Buffer.from(bytes));
        const target=await open();
        // A fresh installation; separate IndexedDB and no shared browser profile.
        await target.page.evaluate(async bytes=>{await window.releaseQA.importSystem(new File([new Uint8Array(bytes)],'qa-backup.zip',{type:'application/zip'}));},bytes);
        const actual=await snapshot(target.page);
        if(mode==='full'){
            // Legacy data URLs can be migrated into tokens; compare decoded pixels independently.
            const a=structuredClone(actual.sar),e=structuredClone(expected.sar);
            delete a.fishingMarket.sarFamiliarity.souvenirs[0].draft.legacyPhoto;
            delete e.fishingMarket.sarFamiliarity.souvenirs[0].draft.legacyPhoto;
            assert.deepEqual(a,e);
            assert.deepEqual(actual.photoBytes,expected.photoBytes);assert.deepEqual(actual.legacyBytes,expected.legacyBytes);
            assert.deepEqual(actual.char.vrState,expected.char.vrState);
            assert.deepEqual(actual.user.vrState,expected.user.vrState);
            assert.deepEqual(actual.messages,expected.messages);
            assert.deepEqual(actual.themes,expected.themes);
            assert.equal(actual.char.chatBackground,expected.char.chatBackground);
        }else if(mode==='text_only'){
            assert.equal(actual.sar.fishingMarket.sarFamiliarity.npcs.caian.pending.runId,'qa-run');
            assert.deepEqual(actual.sar.fishingMarket.dinosaurGarden,expected.sar.fishingMarket.dinosaurGarden);
            assert.deepEqual(actual.sar.fishingMarket.sarCommerce,expected.sar.fishingMarket.sarCommerce);
            assert.equal(actual.photoBytes,null);assert.equal(actual.legacyBytes,null);
            assert.deepEqual(actual.themes,expected.themes);
        }else{
            assert.equal(actual.sar.club,undefined);assert.equal(actual.sar.fishingMarket,undefined);
            assert.deepEqual(actual.input,{sendButtonGenerates:false,enterToSend:true,autoReply:false,emojiSuggestions:false});
            assert.deepEqual(actual.flags,{anniversary:null,release:null});
        }
        if(mode!=='media_only'){
            assert.deepEqual(actual.input,expected.input);assert.deepEqual(actual.flags,expected.flags);
            assert.deepEqual(actual.sar.preferences,expected.sar.preferences);
            assert.equal(await target.page.evaluate(()=>window.releaseQA.theme.wallpaper),'./anniversary/cake-stripes.jpg');
        }
        results.push({mode,bytes:bytes.length,restored:true});await target.context.close();
    }
    await source.context.close();assert.deepEqual(errors,[]);
    writeFileSync(`${out}/report.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
