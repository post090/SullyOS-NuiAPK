import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('output/social-motion-intake');
const selected=JSON.parse(fs.readFileSync('art/chibi/motion-sources/home-approved-selection.json')).entries,ids=new Set(selected.map(e=>e.id));
const frozen='art/chibi/motion-sources/home-source-catalog.json';
let sources;
if(fs.existsSync(frozen))sources=JSON.parse(fs.readFileSync(frozen));
else{sources=['catalog.json','poses/catalog.json'].flatMap(p=>JSON.parse(fs.readFileSync(path.join(root,p))).entries).filter(e=>ids.has(e.id)).map(e=>({...e,approved:true}));fs.writeFileSync(frozen,JSON.stringify(sources,null,2)+'\n');}
if(sources.length!==53||sources.some(e=>!ids.has(e.id)))throw Error('Selection mismatch');
const keep=new Set();
for(const e of sources)for(const url of [...e.files,e.preview,e.thumbnail].filter(Boolean)){
 const relative=path.relative(root,path.resolve(decodeURIComponent(url.slice(1))));if(!relative.startsWith('..')){keep.add(relative.toLowerCase());if(e.kind==='pose'){const stem=relative.replace(/\.[^.]+$/,'');for(const ext of ['bvh','meta','thumb','png','preview.json'])keep.add((stem+'.'+ext).toLowerCase());}}
}
let removed=0,bytes=0;
function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const absolute=path.resolve(dir,item.name),relative=path.relative(root,absolute);
 if(relative.startsWith('..')||path.isAbsolute(relative)||item.isSymbolicLink())throw Error('Unsafe cleanup path: '+absolute);
 if(item.isDirectory()){visit(absolute);continue;}
 const media=/\.(vrma|bvh|vmd|pmd|anim|unitypackage|zip|fcl|png|thumb|meta)$/i.test(item.name)||item.name.endsWith('.preview.json')||relative.toLowerCase().startsWith('couple-research'+path.sep);
 if(media&&!keep.has(relative.toLowerCase())){bytes+=fs.statSync(absolute).size;removed++;if(process.argv.includes('--prune'))fs.unlinkSync(absolute);}
}}
visit(root);
const motions=sources.filter(e=>e.kind!=='pose'),poses=sources.filter(e=>e.kind==='pose');
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify({stats:{entries:motions.length,selected:true},entries:motions},null,2));
fs.writeFileSync(path.join(root,'poses/catalog.json'),JSON.stringify({entries:poses,pending:[]},null,2));
console.log(JSON.stringify({motions:motions.length,poses:poses.length,removed,bytes,pruned:process.argv.includes('--prune')}));
