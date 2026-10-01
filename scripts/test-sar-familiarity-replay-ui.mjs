import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/fishing-qa/npc-lines/replay';
mkdirSync(out, { recursive: true });
const browser=await chromium.launch({headless:true}), context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), page=await context.newPage(), errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}}));
try {
    await page.goto('http://127.0.0.1:5177/test/fixtures/sar-commerce.html');
    await page.getByRole('button',{name:'打开商店',exact:true}).waitFor();
    await page.evaluate(async()=>{
        const S=await import('/utils/vrWorld/sarFamiliarity/state.ts'),M=await import('/utils/vrWorld/fishingMarket.ts'),C=await import('/utils/vrWorld/sarFamiliarity/catalog.ts');
        let now=Date.now();const p=(npc='aiven')=>M.readFishingMarketState().sarFamiliarity.npcs[npc];
        const finish=async(npc='aiven')=>{for(let i=0;i<500;i++){
            const c=p(npc).pending;if(!c)return;const n=C.familiarityScene(c.sceneId).nodes[c.nodeId];
            const draft={confirmed:true,date:new Date(now).toLocaleDateString('zh-CN')};
            if(n.effect?.kind==='membership-card')draft.membership={name:'小雨',chibi:''};
            if(n.effect?.kind==='photo-studio')draft.photo={actors:[{id:'caian',name:'凯恩',npc:'caian',x:26,y:86,scale:1},{id:'user',name:'小雨',x:50,y:89,scale:1},{id:'aiven',name:'艾文',npc:'aiven',x:74,y:86,scale:1}],background:'lounge',panX:0,panY:0,zoom:1,date:draft.date};
            await S.advanceFamiliarity(npc,c,{now,choice:n.choices?0:undefined,draft});
        }throw Error('no finish');};
        // Complete real authored visits, rather than hand-constructing unlocked scenes.
        for(const npc of ['caian','aiven']) {
            for(let i=0;i<40;i++,now+=86400000){
                await S.visitFamiliarity(npc,{userName:'小雨',now,random:()=>.7});
                if(p(npc).offerId){await S.startFamiliarity(npc,p(npc).offerId,{userName:'小雨',now});await finish(npc);}
                const ready=S.readyFamiliarityEvent(M.readFishingMarketState().sarFamiliarity,npc);
                if(ready){await S.startFamiliarity(npc,ready.id,{userName:'小雨',now});await finish(npc);}
                if(p(npc).stars===2){now+=86400000;break;}
            }
            if(p(npc).stars!==2)throw Error(`${npc} did not reach two stars`);
        }
        let rolls=[0,0,.999];await S.visitFamiliarity('aiven',{userName:'小雨',now,random:()=>rolls.shift()??0});
        if(p().offerId!=='A2-E03')throw Error('Expected coupon rain');
        await S.startFamiliarity('aiven',p().offerId,{userName:'小雨',now});await finish();
        const React=(await import('/node_modules/.vite/deps/react.js')).default,client=await import('/node_modules/.vite/deps/react-dom_client.js'),{OSProvider}=await import('/context/OSContext.tsx'),{SARFamiliarityDialog}=await import('/apps/vrWorld/SARFamiliarityDialog.tsx');
        const host=document.createElement('div');document.body.append(host);
        window.qaReplayRoot=(client.createRoot||client.default.createRoot)(host);
        window.qaRenderReplay=id=>window.qaReplayRoot.render(React.createElement(OSProvider,null,React.createElement(SARFamiliarityDialog,{key:id,npc:C.familiarityScene(id).npc,sceneId:id,onClose:()=>{},onEditUserChibi:()=>{},onOpenGuide:()=>{}})));
        window.qaRenderReplay('A2-E03');
    });
    await page.getByRole('dialog',{name:'艾文的回忆'}).waitFor();
    const before=await page.evaluate(()=>localStorage.getItem('vr_fishing_market_v1'));
    const seenEffects = new Set();
    const cases = [['A2-E03','优惠券雨'],['A2-SPECIAL','今天的风儿很喧嚣啊'],['C1-SPECIAL',''],['C2-SPECIAL','']];
    for(const [id,title] of cases) {
        if(id!=='A2-E03')await page.evaluate(id=>window.qaRenderReplay(id),id);
        await page.waitForFunction(id=>JSON.parse(window.render_game_to_text?.()||'{}').scene===id,id);
        for(let i=0;i<300;i++) {
            if(await page.getByRole('button',{name:'返回名册',exact:true}).count())break;
            const state = await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
            if (state.effect && !seenEffects.has(state.effect)) {
                seenEffects.add(state.effect);
                if (['coupon-rain','membership-card','photo-studio'].includes(state.effect)) await page.screenshot({path:`${out}/${state.effect}.png`,animations:'disabled'});
            }
            await page.locator('.srf-dialog .srf-responses button').first().click({timeout:5000});
            await page.waitForFunction(()=>!document.querySelector('.srf-dialog .srf-responses button')?.disabled,undefined,{timeout:5000});
        }
        await page.getByRole('button',{name:'返回名册',exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>localStorage.getItem('vr_fishing_market_v1')),before);
    }
    for(const effect of ['coupon-rain','discount','membership-card','photo-studio']) assert(seenEffects.has(effect),`${effect} was not reached`);
    assert.deepEqual(errors,[]);assert.equal(JSON.parse(before).sarFamiliarity.coupons.length,3);
    writeFileSync(`${out}/result.json`,JSON.stringify({errors,scenes:cases.map(([id])=>id),effects:[...seenEffects],canonicalStorageUnchanged:true},null,2));
    console.log('Replay UI passed: coupon rain, discount, membership card and photo studio remain playable and never write canonical progress or rewards.');
} catch(error) {
    console.log('Audit failed:',error.message);
    console.log(await page.evaluate(()=>({state:window.render_game_to_text?.(),buttons:[...document.querySelectorAll('.srf-dialog button')].map(b=>({text:b.textContent,disabled:b.disabled})),text:document.querySelector('.srf-dialog')?.textContent})));
    await page.screenshot({path:`${out}/failure.png`});
    process.exitCode=1;
} finally {await browser.close();}
