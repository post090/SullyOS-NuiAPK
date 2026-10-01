import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { chromium } from 'playwright';

const bytes=await readFile(new URL('../public/dino-models/aiven-chimera.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const meshes=[];gltf.scene.traverse(node=>{if(node.isMesh)meshes.push(node);});
assert.equal(meshes.length,1,'one draw call for the whole toy');
const geometry=meshes[0].geometry,bounds=new T.Box3().setFromObject(gltf.scene);
assert(bounds.max.y>3.5&&bounds.max.y<3.9,'full long neck and top horns');
assert(bounds.min.x < -2&&bounds.max.x>1.5,'the curled tail and nose are complete');
assert(geometry.index.count/3<10000,'mobile geometry budget');
for(const name of ['position','normal','color','uv'])assert(Array.from(geometry.getAttribute(name).array).every(Number.isFinite),`${name} is finite`);
const uv=geometry.getAttribute('uv');let body=false,accent=false,fixed=false;
for(let i=0;i<uv.count;i++){body ||= uv.getX(i)>.5;accent ||= uv.getY(i)>.5;fixed ||= uv.getX(i)===0&&uv.getY(i)===0;}
assert(body&&accent&&fixed,'body/plate paint channels and fixed eyes survive export');
const output='output/fishing-qa/npc-lines/chimera';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];const shots=[];
try{
  for(const width of [390,320,1100]){
    const context=await browser.newContext({viewport:{width,height:width===1100?860:844},deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    await page.goto('http://127.0.0.1:5177/test/fixtures/aiven-chimera.html');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text?.()||'{}').ready);
    const snapshot=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    let state=await snapshot();assert.deepEqual(state.loaded,['qa-aiven-chimera']);assert.equal(state.morphBuilds,1);assert.equal(state.error,'');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
    const file=`${width}-portrait.png`;await page.screenshot({path:`${output}/${file}`});shots.push(file);
    const catalog=await page.evaluate(async()=>{const {dinoDefinition}=await import('/utils/vrWorld/dinosaurCatalog.ts');return dinoDefinition('aiven-chimera');});
    assert.equal(catalog.name,'？？？');
    if(width===390){
      await page.getByRole('button',{name:'试试换色'}).click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).paint.body==='#e0bb80');
      await page.screenshot({path:`${output}/390-painted.png`});shots.push('390-painted.png');
      await page.getByRole('button',{name:'原始配色'}).click();
      await page.getByRole('button',{name:'打招呼',exact:true}).click();await page.evaluate(()=>window.advanceTime(240));
      state=await snapshot();assert(state.activities['qa-aiven-chimera'].position.y>.04,'greeting lifts the toy gently');
      await page.getByRole('button',{name:'放进箱庭'}).click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).view==='garden');await page.evaluate(()=>window.advanceTime(360));
      state=await snapshot();assert.deepEqual(state.loaded,['qa-aiven-chimera']);assert.equal(state.error,'');assert(state.activities['qa-aiven-chimera'].morph.some(n=>Math.abs(n)>.001),'garden activities animate the long-neck toy');
      await page.screenshot({path:`${output}/390-garden.png`});shots.push('390-garden.png');
      await page.getByRole('button',{name:'查看模型'}).click();
      const canvas=page.locator('canvas'),rect=await canvas.boundingBox();const before=(await snapshot()).azimuth;
      await page.mouse.move(rect.x+rect.width*.35,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.75,rect.y+rect.height*.5,{steps:12});await page.mouse.up();await page.evaluate(()=>window.advanceTime(360));
      assert(Math.abs((await snapshot()).azimuth-before)>.1,'orbit works');
      await page.screenshot({path:`${output}/390-rotated.png`});shots.push('390-rotated.png');
      await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'打招呼',exact:true}).click();await page.evaluate(()=>window.advanceTime(360));
      assert((await snapshot()).activities['qa-aiven-chimera'].morph.every(n=>n===0),'reduced motion stays still');
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({model:{triangles:geometry.index.count/3,bytes:bytes.length,meshes:meshes.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},shots,errors,checks:['GLB geometry','paint channels','portrait/garden','greeting','orbit','reduced motion','320/390/1100 px','catalog identity']},null,2));
  console.log(`Aiven chimera: ${geometry.index.count/3} triangles; ${shots.length} screenshots; no browser errors.`);
}finally{await browser.close();}
