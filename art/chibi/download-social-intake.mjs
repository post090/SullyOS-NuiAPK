// Restore the exact public files in social-intake-manifest.json into ignored local storage.
// Usage: pnpm exec node art/chibi/download-social-intake.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('output/social-motion-intake');
const manifest=JSON.parse(fs.readFileSync('art/chibi/motion-sources/social-intake-manifest.json','utf8'));
const approved=JSON.parse(fs.readFileSync('art/chibi/motion-sources/home-approved-selection.json')).entries;
const paths=new Set(approved.flatMap(e=>e.files).map(p=>decodeURIComponent(p).replace('/output/social-motion-intake/','')));
const files=manifest.files.filter(f=>paths.has(f.localPath)||/license|notice|readme/i.test(f.path));
const jobs=[...files],results=[];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(root,{recursive:true});
await Promise.all(Array.from({length:4},async()=>{while(jobs.length){const file=jobs.shift();const dest=path.resolve(root,file.localPath),relative=path.relative(root,dest);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe destination');if(new URL(file.url).hostname!=='raw.githubusercontent.com')throw Error('Unexpected source host');
 if(fs.existsSync(dest)&&digest(fs.readFileSync(dest))===file.sha256){results.push({...file,status:'already-present'});continue;}
 for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(file.url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(digest(bytes)!==file.sha256)throw Error('SHA256 mismatch');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);results.push({...file,status:'downloaded'});break;}catch(error){if(attempt===2)results.push({...file,status:'failed',error:String(error)});}}
 if(results.length%25===0)console.log(`${results.length}/${manifest.files.length}`);
}}));
for(const group of ['download-manifest.json','social-download-manifest.json'])fs.writeFileSync(path.join(root,group),JSON.stringify(files.filter(f=>f.manifest===group).map(({manifest,...file})=>file),null,2));
fs.mkdirSync(path.join(root,'CMU'),{recursive:true});fs.copyFileSync('art/chibi/motion-sources/CMU-cgspeed-README.txt',path.join(root,'CMU/README-license.txt'));
fs.writeFileSync(path.join(root,'restore-results.json'),JSON.stringify(results,null,2));
const failed=results.filter(x=>x.status==='failed');console.log(JSON.stringify({total:results.length,downloaded:results.filter(x=>x.status==='downloaded').length,alreadyPresent:results.filter(x=>x.status==='already-present').length,failed}));if(failed.length)process.exitCode=1;
