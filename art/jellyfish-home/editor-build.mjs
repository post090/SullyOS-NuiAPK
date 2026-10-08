import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
await build({entryPoints:['art/jellyfish-home/editor-entry.js'],outfile:'output/jellyfish-home/editor.js',bundle:true,format:'esm',target:'es2022',sourcemap:true});
await writeFile('output/jellyfish-home/editor.html','<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:,"><title>我的小小世界</title><link rel="stylesheet" href="./editor.css"><style>html,body,#home{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="home"></div><script type="module" src="./editor.js"></script></body></html>');
