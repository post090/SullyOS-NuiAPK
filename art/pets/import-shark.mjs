import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,saveGlb} from '../jellyfish-home/asset-geometry.mjs';
const file=process.argv[2];if(!file)throw Error('Pass the source shark GLB path');
const b=await fs.readFile(file),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
const g=mergeGeometries(await readGeometry(file));g.computeVertexNormals();const root=new T.Group();root.add(new T.Mesh(g,new T.MeshStandardMaterial({color:'#a8b6c1',roughness:.8})));
await saveGlb(root,'art/pets/sources/7.glb');
console.log(JSON.stringify({bytes:b.length,images:j.images?.length,materials:j.materials?.length,triangles:g.index.count/3,parts:splitParts(g).map(p=>({count:p.count,min:p.box.min.toArray(),max:p.box.max.toArray()}))}));
