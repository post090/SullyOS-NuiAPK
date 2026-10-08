// Local-only, read-only preview server. Exposes this artwork and Three.js only.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const roots={art:here,asset:path.resolve(here,'../../output/jellyfish-home'),three:path.resolve(here,'../../node_modules/three')};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let root=roots.art,rel=pathname==='/'?'index.html':pathname.slice(1);
    if(pathname.startsWith('/assets/')){root=roots.asset;rel=pathname.slice(8)}
    if(pathname.startsWith('/three/')){root=roots.three;rel=pathname.slice(7)}
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!['GET','HEAD'].includes(req.method)){res.writeHead(403).end();return}
    const info=await stat(file);if(!info.isFile()){res.writeHead(404).end();return}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404).end()}
});
server.listen(4178,'127.0.0.1',()=>console.log('Jellyfish home: http://127.0.0.1:4178'));
