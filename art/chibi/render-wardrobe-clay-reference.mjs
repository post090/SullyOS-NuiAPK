import fs from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/tiaotiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const gray=!process.argv.includes('--color'),directory=gray?'output/wardrobe-clay-reference':'output/wardrobe-color-reference';await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[],report=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5198/art/chibi/wardrobe-clay-reference.html');await page.waitForFunction(()=>window.renderClay);
 for(const id of ['hood-parka','belt-coat'])for(const view of ['front','back']){
  const data=await page.evaluate(async({id,view,gray})=>({png:await window.renderClay(id,view,gray),report:window.clayReport}),{id,view,gray});
  const file=`${directory}/${id}-${view}.png`;await fs.writeFile(file,Buffer.from(data.png.split(',')[1],'base64'));report.push({...data.report,file});console.log(file);
 }
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
