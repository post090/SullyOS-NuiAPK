import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out='output/sar-market-encounters';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{
 localStorage.setItem('sar-facility-guide-board-v1','done');
 localStorage.setItem('sar-feature-update-2026-09-16-bulk-fish-v1:board','done');
});
const page=await context.newPage(),errors=[];let calls=0;
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.pathname.includes('/chat/completions')){
  calls++;
  const scene=JSON.parse(route.request().postDataJSON().messages[1].content),ids=scene.visitors.map(v=>v.id);
  const mode=['buy','work','free'][calls-1],price=mode==='buy'?16:mode==='work'?9:0;
  const personas=scene.visitors.map((v,i)=>({actorId:v.id,...(v.persona||{name:'试音员'+i,identity:'给电梯配音的实习生'})}));
  const actions=[{actorId:ids[0],action:'encounter',ref:'n1',mode,price,title:'纸箱电梯第'+calls+'班',words:'专业报站，不保证离地。',event:{story:'{{participant}}刚进门，试音员就宣布抵达三楼。门外仍是一楼。他递来成绩单：老师说我声音上去了，人没有。'}},
   ...ids.slice(1).map(actorId=>({actorId,action:'comment',targetId:'n1',words:'货梯转专业了？'})),{actorId:ids[0],action:'comment',targetId:'n1',words:'现在主修客梯。'}];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({personas,actions})}}]})});
 }
 return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({status:200,body:'',headers:{'access-control-allow-origin':'*'}});
});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('vr_fishing_market_v1')));
try{
 await page.goto(`${process.env.SAR_QA_URL||'http://127.0.0.1:5183'}/test/fixtures/sar-facilities.html?facility=board`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.facilityQA?.os.characters.length>=60);
 await page.evaluate(()=>{Math.random=()=>.1;});
 const starting=(await state()).accounts.user;
 for(let i=1;i<=3;i++){
  await page.getByRole('button',{name:'刷新布告板',exact:true}).click();
  await page.getByRole('status').filter({hasText:'来过了'}).waitFor();
  await page.getByRole('button').filter({hasText:'纸箱电梯第'+i+'班'}).click();
  assert.equal(await page.getByRole('region',{name:'路人小事件'}).count(),0);
  assert.equal(await page.getByText(/老师说我声音上去了/).count(),0,'hidden story stays out of the DOM');
  const participate=page.getByRole('button',{name:i===1?'支付 16 鳞币，参与':i===2?'接下这份活 · 酬谢 9 鳞币':'去看看',exact:true});
  await participate.evaluate(b=>{b.click();b.click();});
  await page.getByRole('region',{name:'路人小事件'}).waitFor();
  assert.equal(calls,i,'participation does not call a model');
  const current=await state(),post=[...current.listings,...current.requests].find(p=>p.itemLabel==='纸箱电梯第'+i+'班');
  assert.equal(post.encounterResult.participantId,'user');
  assert(!post.encounterResult.story.includes('{{participant}}'));
  assert.equal(current.accounts.user,starting-16+(i>=2?9:0));
  assert.equal(current.ledger.filter(e=>e.text.includes('游戏内')&&e.text.includes('纸箱电梯第'+i+'班')).length,1);
  await page.screenshot({path:`${out}/event-${i}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'返回上一页',exact:true}).click();
 }
 await page.getByRole('button',{name:'布告板更多',exact:true}).click();
 await page.getByRole('button').filter({hasText:'往期便笺'}).click();
 await page.getByRole('button').filter({hasText:'纸箱电梯第1班'}).click();
 await page.getByRole('region',{name:'路人小事件'}).waitFor();
 await page.setViewportSize({width:320,height:640});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${out}/archive-320.png`,animations:'disabled'});
 assert.deepEqual(errors,[]);
 writeFileSync(`${out}/report.json`,JSON.stringify({calls,paidFreeAndWork:true,hiddenUntilParticipation:true,oneSettlement:true,archive:true,errors},null,2));
 console.log('Market encounters passed: hidden story, payment/reward/free, one settlement, no extra model call, archive and 320px layout.');
}finally{await browser.close();}
