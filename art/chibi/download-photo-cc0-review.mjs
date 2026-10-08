import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
const dir=path.resolve('output/photo-cc0-review');fs.mkdirSync(dir,{recursive:true});const manifest=[];
for(const pack of ['poses01','poses02','poses03','poses04']){
 const source=`https://static.makehumancommunity.org/assets/assetpacks/${pack}.html`,html=await(await fetch(source,{signal:AbortSignal.timeout(45000)})).text();if(!html.includes('CC0'))throw Error('License missing '+pack);fs.writeFileSync(`${dir}/${pack}-source.html`,html);
 const url=`https://files.makehumancommunity.org/asset_packs/${pack}/${pack}_cc0.zip`;const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());fs.writeFileSync(`${dir}/${pack}.zip`,bytes);const dest=path.resolve(dir,pack);let count=0;
 for(const [name,data]of Object.entries(unzipSync(bytes))){if(!/\.(bvh|meta|thumb|png|txt)$/i.test(name))continue;const target=path.resolve(dest,name);if(!target.startsWith(dest+path.sep))throw Error('Unsafe archive entry');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);if(name.endsWith('.bvh'))count++;}
 manifest.push({pack,source,url,license:'CC0-1.0',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,poses:count});fs.writeFileSync(`${dir}/download-manifest.json`,JSON.stringify(manifest,null,2));console.log(pack,count,bytes.length);
}
