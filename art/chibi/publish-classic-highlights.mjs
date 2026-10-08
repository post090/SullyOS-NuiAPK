// Recover six white highlight choices from the user's shipped eye drawings.
// Do not normalize bounds: every output keeps the original 472px registration.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(path.resolve('node_modules/.pnpm',fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('sharp@')),'node_modules/sharp'));
const assets={};
for(const [index,style] of ['01','02','03','05','06','07'].entries()){
 const source=`like520/parts/eyes_${style}.png`,sourceBytes=fs.readFileSync(`public/${source}`);
 const original=await sharp(sourceBytes).ensureAlpha().raw().toBuffer();
 const iris=await sharp(`public/room3d/face/iris-${style}-open.png`).ensureAlpha().raw().toBuffer();
 const candidate=new Uint8Array(472*472),seen=new Uint8Array(candidate.length),output=new Uint8Array(original.length);
 for(let y=2;y<470;y++)for(let x=2;x<470;x++){
  const p=y*472+x,i=p*4;
  // The two-pixel interior excludes white sclera touching the iris silhouette.
  let inside=true;
  for(let dy=-2;dy<=2&&inside;dy++)for(let dx=-2;dx<=2;dx++)if(iris[((y+dy)*472+x+dx)*4+3]<240){inside=false;break;}
  if(!inside)continue;
  const gray=Math.min(original[i],original[i+1],original[i+2]);
  // 07 has only a pale lower glint, rather than a white upper highlight.
  // Turn that existing mark white; do not invent an upper mark for this style.
  const threshold=style==='07'?175:210;
  if(gray>threshold)candidate[p]=Math.round(original[i+3]*Math.min(1,(gray-threshold)/(style==='07'?25:35)));
 }
 for(let p=0;p<candidate.length;p++)if(candidate[p]&&!seen[p]){
  const component=[p];seen[p]=1;
  for(let k=0;k<component.length;k++){
   const q=component[k],x=q%472;
   for(const next of [x?q-1:-1,x<471?q+1:-1,q-472,q+472])if(next>=0&&next<candidate.length&&candidate[next]&&!seen[next]){seen[next]=1;component.push(next);}
  }
  if(component.length<8)continue;
  for(const q of component)output.set([255,255,255,candidate[q]],q*4);
 }
 const id=`classic-${String(index+1).padStart(2,'0')}`,src=`room3d/face/highlight-${id}.png`;
 const png=await sharp(Buffer.from(output),{raw:{width:472,height:472,channels:4}}).png().toBuffer();
 fs.writeFileSync(`public/${src}`,png);
 assets[`highlight-${id}`]={src,source,sourceStyle:style,sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),sha256:createHash('sha256').update(png).digest('hex')};
 console.log(`${id} ← eyes_${style}: ${output.filter((v,i)=>i%4===3&&v>0).length} pixels`);
}
fs.writeFileSync('apps/room3d/chibi/faceHighlights.json',JSON.stringify({assets},null,2)+'\n');
