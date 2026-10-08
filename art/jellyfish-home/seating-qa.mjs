import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ROOM3D_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await mkdir('output/sofa-seating',{recursive:true});
 await page.goto('http://127.0.0.1:5174/test/fixtures/room3d-seating.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__homeEditor,undefined,{timeout:60000});
 const click=(action,extra='')=>page.locator(`[data-action="${action}"]${extra}`).click(),inspect=()=>page.evaluate(()=>window.__homeEditor.inspect());
 const start=await inspect(),sofa=start.rooms[0].items.find(i=>i.assetId==='petal_sofa');
 const handGeometry=()=>page.evaluate(()=>{const hands=[];window.__visitor.root.traverse(o=>{if(o.name.startsWith('chibi-hand-'))hands.push({name:o.name,scale:o.scale.toArray(),positions:Array.from(o.geometry.attributes.position.array)});});return hands;});
 const restHands=await handGeometry();assert.ok(restHands.length>0);
 const bodyGeometry=()=>page.evaluate(()=>{const bodies=[];window.__visitor.root.traverse(o=>{if(o.name==='chibi-body')bodies.push(Array.from(o.geometry.attributes.position.array));});return bodies;});
 await page.evaluate(()=>window.__visitor.animate(1,'idle'));const restBodies=await bodyGeometry();
 await click('panel','[data-panel="chibi"]');await click('chibi-sit','[data-seat="left"]');await page.evaluate(()=>window.advanceTime(1000));
 await page.evaluate(()=>window.__visitor.animate(1,'sit'));
 let state=await inspect();assert.equal(state.chibiMotion,'idle');assert.equal(state.chibiSeat.itemId,sofa.id);assert.ok(Math.abs(state.chibiPosition[1]-(sofa.y+.63))<1e-6);
 let extended=0;const seatedBodies=await bodyGeometry();for(let m=0;m<restBodies.length;m++)for(let i=0;i<restBodies[m].length;i+=3){const rest=restBodies[m],sit=seatedBodies[m];assert.ok(Math.abs(rest[i]-sit[i])<1e-6);assert.ok(Math.abs(rest[i+1]-sit[i+1])<1e-6);if(rest[i+1]>.105)assert.ok(Math.abs(rest[i+2]-sit[i+2])<1e-6,'torso must not become an extended pedestal');else if(sit[i+2]>rest[i+2]+.01)extended++;}assert.ok(extended>0,'tiny toes should extend');
 assert.deepEqual(await handGeometry(),restHands);
 const lowestBody=await page.evaluate(()=>{const root=window.__visitor.root;root.updateWorldMatrix(true,true);let min=Infinity;root.traverse(o=>{if(o.name!=='chibi-body')return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)min=Math.min(min,o.localToWorld(root.position.clone().set(p.getX(i),p.getY(i),p.getZ(i))).y);});return min;});
 assert.ok(lowestBody>=sofa.y+.63-.002,'feet must not be buried in the cushion');assert.ok(lowestBody<sofa.y+.63+.03,'feet should contact the cushion');
 await click('panel','[data-panel="chibi"]');await click('chibi-sit','[data-seat="right"]');assert.ok(Math.abs((await inspect()).chibiPosition[0]-sofa.x-.94)<1e-6);
 await click('panel','[data-panel="chibi"]');await click('chibi-sit','[data-seat="left"]');
 const pair=await page.evaluate(()=>window.showPair());assert.ok(pair.gap>.30);await page.screenshot({path:'output/sofa-seating/two-children.png'});await page.evaluate(()=>window.__companion.dispose());
 await page.screenshot({path:'output/sofa-seating/room.png'});
 await click('panel','[data-panel="chibi"]');await click('chibi-view');await page.screenshot({path:'output/sofa-seating/front.png'});
 await click('turn-view','[data-angle="-.785398"]');await page.screenshot({path:'output/sofa-seating/side.png'});
 await click('turn-view','[data-angle=".785398"]');await click('turn-view','[data-angle=".785398"]');await page.screenshot({path:'output/sofa-seating/profile.png'});
 await click('panel','[data-panel="chibi"]');await click('chibi-sit','[data-seat="center"]');assert.equal((await inspect()).chibiSeat.itemId,start.rooms[0].items.find(i=>i.assetId==='petal_armchair').id);
 await click('panel','[data-panel="chibi"]');await click('chibi-view');await click('turn-view','[data-angle="-.785398"]');await page.screenshot({path:'output/sofa-seating/armchair.png'});
 // Emotes layer over the seated posture; only explicit standing releases the seat.
 await click('panel','[data-panel="chibi"]');const seated=await inspect();
 const pose=()=>page.evaluate(()=>{let parent;const hands=[];window.__visitor.root.traverse(o=>{if(o.name==='chibi-body')parent=o.parent;if(o.name.startsWith('chibi-hand-'))hands.push(o.rotation.toArray().slice(0,3));});return {position:parent.position.toArray(),rotation:parent.rotation.toArray().slice(0,3),scale:parent.scale.toArray(),hands};});
 for(const motion of ['wave-cute','wave-calm','sleep','angry','dance','idle']){
  await click('chibi-motion',`[data-value="${motion}"]`);await page.evaluate(()=>window.advanceTime(550));state=await inspect();
  assert.equal(state.chibiPosture,'seated');assert.deepEqual(state.chibiSeat,seated.chibiSeat);assert.deepEqual(state.chibiPosition,seated.chibiPosition);assert.deepEqual(await handGeometry(),restHands);
  const first=await pose();assert.deepEqual(first.position,[0,0,0]);assert.deepEqual(first.rotation,[0,0,0]);assert.deepEqual(first.scale,[1,1,1]);
  if(motion.startsWith('wave')){await page.evaluate(()=>window.advanceTime(180));assert.notDeepEqual((await pose()).hands,first.hands,'hands must actually wave');}
  await page.screenshot({path: `output/sofa-seating/seated-${motion}.png`});
 }
 await click('chibi-stand');state=await inspect();assert.equal(state.chibiPosture,'standing');assert.equal(state.chibiSeat,null);assert.equal(state.chibiPosition[1],start.chibiPosition[1]);assert.equal(state.chibiRotation,0);
 await click('chibi-motion','[data-value="wave-cute"]');await page.evaluate(()=>{window.__visitor.animate(.55,'wave-cute','standing');});assert.ok((await pose()).position[1]>.1,'standing cute wave still hops');
 await click('chibi-motion','[data-value="sleep"]');await page.evaluate(()=>{window.__visitor.animate(1,'sleep','standing');});assert.ok((await pose()).rotation[2]>1,'standing sleep still lies down');
 await click('chibi-sit','[data-seat="left"]');
 // Remove the nearby table so sofa rotation has enough clearance.
 for(const assetId of ['table','petal_armchair']){await page.evaluate(id=>window.__homeEditor.select(id),start.rooms[0].items.find(i=>i.assetId===assetId).id);await click('store');}
 await page.evaluate(id=>window.__homeEditor.select(id),sofa.id);await click('rotate');await click('place-rotation');state=await inspect();assert.equal(state.chibiMotion,'idle');assert.ok(Math.abs(state.chibiRotation-Math.PI/2)<1e-6);assert.ok(Math.abs(state.chibiPosition[0]-sofa.x-.55)<1e-6);
 await click('undo');assert.equal((await inspect()).chibiRotation,0);await click('redo');assert.ok(Math.abs((await inspect()).chibiRotation-Math.PI/2)<1e-6);
 await page.evaluate(id=>window.__homeEditor.select(id),sofa.id);await click('store');state=await inspect();assert.equal(state.chibiSeat,null);assert.equal(state.chibiMotion,'idle');assert.equal(state.chibiPosition[1],start.chibiPosition[1]);
 await click('undo');await click('panel','[data-panel="chibi"]');await click('chibi-sit','[data-seat="left"]');await click('panel','[data-panel="expand"]');await click('expand','[data-direction="right"]');assert.equal((await inspect()).chibiSeat,null);
 assert.deepEqual(errors,[]);console.log('SEATING_PASS: sit, ground return, rotate/follow, undo/redo, stored release, room release, screenshots');
}finally{await browser.close();}
