import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {reference} from './tailored-current-body.mjs';
import {naturalShirtShell} from './natural-shirt-shell.mjs';
import {surfaceBinding,bindGeometry} from './clothing-details.mjs';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';

const output='output/cardigan-controller/procedural-basics';await fs.mkdir(output,{recursive:true});
const smooth=T.MathUtils.smoothstep,manifest=[];
function weights(values){const sorted=[...values].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,[,w])=>s+w,0);return Array.from({length:4},(_,i)=>[sorted[i]?.[0]??0,(sorted[i]?.[1]??0)/sum]);}
function subset(g,keep){const index=g.index,used=new Map(),ids=[],attrs=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,[]]));for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!keep(tri))continue;for(const id of tri){if(!used.has(id)){used.set(id,used.size);for(const[k,a]of Object.entries(g.attributes))for(let j=0;j<a.itemSize;j++)attrs[k].push(a.getComponent(id,j));}ids.push(used.get(id));}}const result=new T.BufferGeometry();for(const[k,a]of Object.entries(g.attributes))result.setAttribute(k,new T.BufferAttribute(new a.array.constructor(attrs[k]),a.itemSize,a.normalized));result.setIndex(ids);return result;}
function borderRings(g,filter){const edges=new Map(),idx=g.index;for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){const a=idx.getX(i+k),b=idx.getX(i+(k+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}return [...edges.values()].filter(([a,b])=>filter(a)&&filter(b));}
async function publish(id,label,slot,root,body,meshes,extra={}){root.updateMatrixWorld(true);body.skeleton.update();const triangles=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0);const meta={id,label,slot,asset:`${id}-rig.glb`,prefix:'Apparel_',triangles,drawCalls:meshes.length,...extra};root.userData.apparel=meta;await saveGlb(root,`${output}/${id}-rig.glb`);const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${output}/${id}-only.glb`);await fs.copyFile(`${output}/${id}-rig.glb`,`public/room3d/wardrobe/${id}-rig.glb`);manifest.push(meta);console.log(id,triangles);}
function attach(body,id,geometry,name,color){const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({color,roughness:.93,side:T.DoubleSide}));mesh.name=`Apparel_${id}_${name}`;body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);return mesh;}

// Tee: keep the approved fitted sweater's VNeck=0 neckline verbatim, then
// clip its sleeves shorter and give the lower body/short sleeves modest ease.
{
 const root=await reference(),body=root.getObjectByName('Mesh_0'),bytes=await fs.readFile('public/room3d/wardrobe/fitted-sweater-rig.glb');
 const sweater=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const template=sweater.getObjectByName('Apparel_fitted-sweater').geometry;
 const shell=naturalShirtShell(body,{end:.90,tee:true,template});
 const sp=shell.attributes.position,si=shell.attributes.skinIndex,sw=shell.attributes.skinWeight;
 // Shape a soft round front neckline; the back neck remains higher.
 shell.computeVertexNormals();
 const trims=[],seams=borderRings(shell,i=>Math.abs(sp.getX(i))>.85);
 const pos=[],ids=[],skin=[];
 for(const[a,b]of seams){const base=pos.length/3;for(const[id,inner]of [[a,false],[b,false],[b,true],[a,true]]){const p=new T.Vector3().fromBufferAttribute(sp,id);if(inner){p.y=3.125+(p.y-3.125)*.958;p.z=.022+(p.z-.022)*.956;}pos.push(...p.toArray());skin.push(Array.from({length:4},(_,k)=>[si.getComponent(id,k),sw.getComponent(id,k)]));}ids.push(base,base+1,base+3,base+1,base+2,base+3);}
 const edge=new T.BufferGeometry();edge.setAttribute('position',new T.Float32BufferAttribute(pos,3));edge.setIndex(ids);bindGeometry(edge,(_,i)=>skin[i]);trims.push(edge);
 // The copied sweater already contains its continuous folded neck edge.
 // A second lifted subset creates irregular overlapping triangles and dark
 // steps at the back neck, so retain that original edge without an overlay.
 const meshes=[attach(body,'basic-tee',shell,'cloth','#d6dfdb'),attach(body,'basic-tee',mergeGeometries(trims,false),'neck-and-sleeve-edge','#bac9c3')];
 await publish('basic-tee','普通短袖T恤','top',root,body,meshes,{hem:2.25,sleeveExtent:.90,source:'approved fitted-sweater VNeck=0 neckline, current-body thin shell, A-line short sleeve'});
}

// Swim trunks use a regular continuous pattern with a waist sampled from the body.
if(!process.argv.includes('--tee-only')){
 const {swimShorts}=await import('./tailored-swim-shorts.mjs');
 const root=await reference(),body=root.getObjectByName('Mesh_0');
 const meshes=[attach(body,'swim-shorts',swimShorts(body),'cloth','#26384c')];
 await publish('swim-shorts','男士短裤泳衣','bottom',root,body,meshes,{hem:1.60,waist:2.34,source:'body-sampled waistband and continuous short straight leg pattern'});
}
if(process.argv.includes('--tee-only')){const previous=JSON.parse(await fs.readFile(`${output}/manifest-tailored.json`,'utf8'));manifest.push(...previous.filter(m=>m.id!=='basic-tee'));}
await fs.writeFile(`${output}/manifest-tailored.json`,JSON.stringify(manifest,null,2)+'\n');
