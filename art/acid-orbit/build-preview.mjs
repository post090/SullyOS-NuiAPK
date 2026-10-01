import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
await build({entryPoints:['art/acid-orbit/preview.ts'],bundle:true,outfile:'art/acid-orbit/preview.bundle.js',format:'esm',jsx:'automatic',minify:true,loader:{'.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.svg':'dataurl','.woff2':'dataurl'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'inline-css',setup(b){b.onResolve({filter:/\.css\?inline$/},a=>({path:path.resolve(a.resolveDir,a.path.replace(/\?inline$/,'')),namespace:'inline-css'}));b.onLoad({filter:/.*/,namespace:'inline-css'},async a=>({contents:await readFile(a.path,'utf8'),loader:'text'}));}}]});
