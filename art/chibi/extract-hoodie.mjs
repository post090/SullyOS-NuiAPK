import fs from 'node:fs/promises';import * as T from 'three';import {readGeometry,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
function trim(mesh,boot){
 const result=[],p=mesh.attributes.position,idx=mesh.index;
 const planes=boot?[v=>-.235-v.y]:[v=>v.y+.137,v=>.213-v.y,v=>Math.abs(v.x)<.13?1:.241-((Math.abs(v.x)-.068)*.53+(v.y-.135)*-.848)];
 for(let i=0;i<idx.count;i+=3){let poly=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+j)));
  for(const distance of planes){const clipped=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)clipped.push(a);if((da>=0)!==(db>=0))clipped.push(a.clone().lerp(b,da/(da-db)));}poly=clipped;}
  for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])result.push(v.x,v.y,v.z);
 }const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(result,3));const welded=mergeVertices(geo,1e-5);welded.computeVertexNormals();return welded;
}
const path=process.argv[2];if(!path)throw Error('Pass hoodie GLB');const [g]=await readGeometry(path);g.computeBoundingBox();const b=g.boundingBox,h=b.max.y-b.min.y;g.translate(-(b.max.x+b.min.x)/2,-(b.max.y+b.min.y)/2,-(b.max.z+b.min.z)/2);g.scale(1/h,1/h,1/h);
const p=g.attributes.position,groups=[[],[]];for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.getX(i+j)),v=new T.Vector3();for(const id of ids)v.add(new T.Vector3().fromBufferAttribute(p,id));v.multiplyScalar(1/3);const ax=Math.abs(v.x),reach=(ax-.068)*.53+(v.y-.135)*-.848;
if(v.y<-.235)groups[1].push(...ids);else if(v.y<.215&&v.y>-.145&&!(v.y>.177&&ax<.069&&v.z>-.035)&&!(ax>.13&&reach>.241))groups[0].push(...ids);}
await MeshoptSimplifier.ready;const outputs=[],scene=new T.Group();
for(let j=0;j<2;j++){const [index]=MeshoptSimplifier.simplify(new Uint32Array(groups[j]),p.array,3,(j?650:2400)*3,.012);const mesh=trim(await compactGeometry(g,Array.from(index)),j===1);outputs.push({positions:Array.from(mesh.attributes.position.array),indices:Array.from(mesh.index.array)});scene.add(new T.Mesh(mesh,new T.MeshStandardMaterial({color:j?'#eee2d9':'#d994ae',roughness:1,side:T.DoubleSide})));console.log(j,groups[j].length/3,'=>',mesh.index.count/3);}
await fs.writeFile('apps/room3d/chibi/hoodieClothes.json',JSON.stringify(outputs));await saveGlb(scene,'output/retro/hoodie-cut.glb');
