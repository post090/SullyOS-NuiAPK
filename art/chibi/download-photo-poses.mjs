// Restore only the two free CC0 packs authorized for the local photo picker.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
const dir=path.resolve('output/social-motion-intake/poses');fs.mkdirSync(dir,{recursive:true});
const selected=new Set(JSON.parse(fs.readFileSync('art/chibi/motion-sources/home-approved-selection.json')).entries.filter(e=>e.id.startsWith('pose-')).map(e=>e.original));
const packs=[['poses01','67b1d14923adda85f371f81e1c529fcd058f975d0bf93848838e1a3860705b7d'],['poses03','9ea09bab67c99fecf35d149fcb295c2cfa998167053aad2bab566d9053a8acf8']];
for(const [pack,sha256] of packs){
 const archive=path.join(dir,`${pack}.zip`),url=`https://files.makehumancommunity.org/asset_packs/${pack}/${pack}_cc0.zip`;
 let bytes=fs.existsSync(archive)?fs.readFileSync(archive):null;
 if(!bytes||createHash('sha256').update(bytes).digest('hex')!==sha256){const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error(`Source changed: ${pack}`);fs.writeFileSync(archive,bytes);}
 const destination=path.join(dir,pack);let count=0;
 for(const [name,data] of Object.entries(unzipSync(bytes))){if(!/\.(bvh|meta|thumb|png|txt)$/i.test(name)||!selected.has(path.basename(name).replace(/\.[^.]+$/,''))&&!/license|readme/i.test(name))continue;const target=path.resolve(destination,name);if(!target.startsWith(destination+path.sep))throw Error('Unsafe archive path');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);count++;}
 const page=path.join(dir,`${pack}-source.html`);if(!fs.existsSync(page)){const response=await fetch(`https://static.makehumancommunity.org/assets/assetpacks/${pack}.html`);if(!response.ok)throw Error(`Source credits unavailable: ${pack}`);fs.writeFileSync(page,await response.text());}
 console.log(`${pack}: ${count} files, SHA256 verified`);
}
