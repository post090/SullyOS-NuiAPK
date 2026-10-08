import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});await fs.mkdir('output/bedroom',{recursive:true});const errors=[];
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8'));
async function setup(url,mobile=false){const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1100,height:850},isMobile:mobile,hasTouch:mobile});p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto('http://127.0.0.1:5174/test/fixtures/room3d-bedroom.html'+url);await p.waitForFunction(()=>window.__homeEditor,undefined,{timeout:90000});const state=()=>p.evaluate(()=>window.__homeEditor.inspect()),act=async(a,q='')=>{if(a==='panel'&&(await state()).panel===q.match(/data-panel="([^"]+)/)?.[1])return;await p.locator('[data-action="'+a+'"]'+q).first().click();};const advance=ms=>p.evaluate(ms=>window.advanceTime(ms),ms),limbs=()=>p.evaluate(()=>{const out=[];window.__visitor.root.traverse(o=>{if(o.name.startsWith('chibi-action-'))out.push({name:o.name,visible:o.visible,scale:o.scale.toArray()});});return out;});return {p,state,act,advance,limbs};}
try{
 const {p,state,act,advance}=await setup('?empty');
 const add=async id=>{await act('panel','[data-panel="furniture"]');await act('category','[data-value="all"]');await act('add-item','[data-id="'+id+'"]');const s=await state();assert.equal(s.rooms[0].items.find(i=>i.id===s.selected)?.assetId,id,s.message);return s.selected;};
 let painted=0;
 for(const a of catalog.filter(a=>a.collection==='bedroom')){
  const anchor=a.surface==='tabletop'?await add('gaming_desk'):null;
  const id=await add(a.id);await act('palette');await p.locator('[data-furniture-color]').fill('#93bbaa');await p.locator('[data-furniture-color]').dispatchEvent('change');await advance(0);
  const colors=await p.evaluate(id=>{const all=[];window.__visitor.root.parent.parent.traverse(o=>{if(o.userData.itemId===id&&o.userData.assetId)o.traverse(m=>{if(m.isMesh)for(const mat of Array.isArray(m.material)?m.material:[m.material])if(mat.color)all.push([mat.name,mat.color.getHexString()]);});});return all;},id);assert.ok(colors.some(([name,color])=>a.paintMaterials.includes(name)&&color==='93bbaa'),a.id);painted++;
  await act('color','[data-value=""]');assert.equal((await state()).rooms[0].items.find(i=>i.id===id).color,null);
  if(a.seats){for(const s of a.seats){await act('panel','[data-panel="chibi"]');await act('chibi-sit','[data-id="'+id+'"][data-seat="'+s.id+'"]');await advance(500);assert.equal((await state()).chibiPosture,'seated');await act('panel','[data-panel="chibi"]');await act('chibi-view');await p.screenshot({path:'output/bedroom/seat-'+a.id+'-'+s.id+'.png'});}await p.evaluate(id=>window.__homeEditor.select(id),id);}
  await act('store');
  if(anchor){await p.evaluate(id=>window.__homeEditor.select(id),anchor);await act('store');}
 }
 await p.close();console.log('Painted and restored',painted,'bedroom furniture; all seats checked');
 const mobile=await setup('',true);await mobile.act('panel','[data-panel="chibi"]');await mobile.act('chibi-hug');await mobile.advance(700);await mobile.act('panel','[data-panel="chibi"]');await mobile.act('chibi-view');await mobile.p.screenshot({path:'output/bedroom/mobile-hug.png'});await mobile.p.close();
 const bed=await setup('?panel');await bed.act('chibi-bed');await bed.advance(700);await bed.act('panel','[data-panel="chibi"]');await bed.act('chibi-view');await bed.p.screenshot({path:'output/bedroom/sleep-final.png'});await bed.p.close();
 assert.deepEqual(errors,[]);await fs.writeFile('output/bedroom/detail-report.json',JSON.stringify({painted,allSeats:true,mobileFocus:true,errors}));
}finally{await browser.close();}
