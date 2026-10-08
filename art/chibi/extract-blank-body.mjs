import fs from 'node:fs/promises';
import {readGeometry,compactGeometry} from '../jellyfish-home/asset-geometry.mjs';
if(!process.argv[2])throw Error('Usage: pnpm node art/chibi/extract-blank-body.mjs <GLB> [triangle-budget]');
const meshes=await readGeometry(process.argv[2]);
if(meshes.length!==1)throw Error('Expected one connected body mesh');
let [g]=meshes;
g.computeBoundingBox();const b=g.boundingBox,height=b.max.y-b.min.y;
g.translate(-(b.max.x+b.min.x)/2,-(b.max.y+b.min.y)/2,-(b.max.z+b.min.z)/2);g.scale(1/height,1/height,1/height);
const budget=Number(process.argv[3]??Infinity);
if(!(budget>0))throw Error('Triangle budget must be positive');
if(Number.isFinite(budget)){g=await compactGeometry(g,Array.from(g.index.array),budget);if(g.index.count/3>budget)throw Error('Could not meet triangle budget');}
await fs.writeFile('apps/room3d/chibi/blankBody.json',JSON.stringify({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)}));
console.log({vertices:g.attributes.position.count,triangles:g.index.count/3});
