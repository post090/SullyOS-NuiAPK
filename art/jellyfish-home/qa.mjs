import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const runtime=process.env.CODEX_NODE_PACKAGES;
if(!runtime)throw new Error('Set CODEX_NODE_PACKAGES to bundled Node packages directory');
const require=createRequire(path.join(runtime,'package.json'));
const {chromium}=require('playwright');
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../output/jellyfish-home');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
const results=[];
for(const [name,width,height,quality] of [['realtime-square',1100,1100,'high'],['realtime-portrait',900,1200,'high'],['realtime-mobile',430,820,'mobile'],['standalone',700,900,'mobile']]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4178/'+(name==='standalone'?'assets/site/index.html':'')+'?quality='+quality,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).ready,{timeout:60000});
  await page.evaluate(()=>window.advanceTime(500));
  await page.screenshot({path:path.join(out,name+'.png')});
  const before=await page.evaluate(()=>window.__art.floaters.map(x=>x.o.position.y));
  await page.evaluate(()=>window.advanceTime(1500));
  const after=await page.evaluate(()=>window.__art.floaters.map(x=>x.o.position.y));
  const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const batches=await page.evaluate(()=>{
    const r=window.__art.renderer;r.info.autoReset=false;r.info.reset();window.__art.composer.render();
    const info={...r.info.render,geometries:r.info.memory.geometries,textures:r.info.memory.textures};r.info.autoReset=true;return info;
  });
  results.push({name,state,errors,animationMoved:after.some((v,i)=>Math.abs(v-before[i])>.001),render:batches});
  await page.close();
}
await writeFile(path.join(out,'browser-qa.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));await browser.close();
if(results.some(r=>r.errors.length||!r.animationMoved))process.exitCode=1;
