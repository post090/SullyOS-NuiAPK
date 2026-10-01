// Lossless visual geometry; original source art is provided by the project's asset repository.
// Usage: SAR_SHARP_MODULE=/path/to/sharp node scripts/prepare-sar-portraits.mjs <source-directory>
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),sharp=require(process.env.SAR_SHARP_MODULE||'sharp');
const source=process.argv[2]||'output/fishing-qa/npc-lines/original-portraits',target='public/sar-portraits';
const manifest={source:'https://github.com/qegj567-cloud/SullyOS-assets/tree/main/SAR',files:[]};
for(const npc of ['Caian','Aiven']){
    mkdirSync(path.join(target,npc),{recursive:true});
    for(const filename of readdirSync(path.join(source,npc)).filter(f=>/^[A-Za-z][A-Za-z0-9 _-]*\.png$/.test(f))){
        const relative=`${npc}/${filename.replace('.png','.webp')}`,output=path.join(target,relative);
        await sharp(path.join(source,npc,filename)).resize({width:1500,height:1500,fit:'inside',withoutEnlargement:true}).webp({quality:90,alphaQuality:100,effort:6}).toFile(output);
        const {width,height}=await sharp(output).metadata();
        manifest.files.push({path:relative,width,height,bytes:statSync(output).size});
    }
}
writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({portraits:manifest.files.length,totalBytes:manifest.files.reduce((n,f)=>n+f.bytes,0)}));
