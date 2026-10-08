import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {reference} from './tailored-current-body.mjs';
import {surfaceBinding,bindGeometry} from './clothing-details.mjs';
import {naturalShirtShell} from './natural-shirt-shell.mjs';
import {copySailorCuffs} from './sailor-shirt-cuffs.mjs';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';

const output='output/cardigan-controller/clothing-0920b',root=await reference(),body=root.getObjectByName('Mesh_0'),binding=surfaceBinding(body),meshes=[];
const shell=naturalShirtShell(body,{end:1.445}),cuffGeometry=await copySailorCuffs(body),cuffSurface=new T.Mesh(cuffGeometry,new T.MeshBasicMaterial({side:T.DoubleSide})),cuffRay=new T.Raycaster();cuffSurface.updateMatrixWorld();
// The last strip of the sleeve follows the actual copied sailor cuff seam.
for(let i=0;i<shell.attributes.position.count;i++){const p=new T.Vector3().fromBufferAttribute(shell.attributes.position,i),t=T.MathUtils.smoothstep(Math.abs(p.x),1.29,1.442);if(!t)continue;const axis=new T.Vector3(Math.sign(p.x)*1.446,3.125,.03),dir=new T.Vector3(0,p.y-axis.y,p.z-axis.z).normalize();cuffRay.set(axis,dir);cuffRay.far=.5;const hit=cuffRay.intersectObject(cuffSurface)[0];if(hit){p.y=T.MathUtils.lerp(p.y,hit.point.y,t);p.z=T.MathUtils.lerp(p.z,hit.point.z,t);shell.attributes.position.setXYZ(i,p.x,p.y,p.z);const ids=[hit.face.a,hit.face.b,hit.face.c],pts=ids.map(j=>new T.Vector3().fromBufferAttribute(cuffGeometry.attributes.position,j)),bary=T.Triangle.getBarycoord(hit.point,...pts,new T.Vector3()),w=new Map();for(let k=0;k<4;k++){const j=shell.attributes.skinIndex.getComponent(i,k);w.set(j,(w.get(j)??0)+shell.attributes.skinWeight.getComponent(i,k)*(1-t));}for(let a=0;a<3;a++)for(let k=0;k<4;k++){const j=cuffGeometry.attributes.skinIndex.getComponent(ids[a],k);w.set(j,(w.get(j)??0)+cuffGeometry.attributes.skinWeight.getComponent(ids[a],k)*bary.getComponent(a)*t);}const sorted=[...w].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,[,v])=>s+v,0);for(let k=0;k<4;k++){shell.attributes.skinIndex.setComponent(i,k,sorted[k]?.[0]??0);shell.attributes.skinWeight.setComponent(i,k,(sorted[k]?.[1]??0)/sum);}}}shell.computeVertexNormals();
const surface=new T.Mesh(shell,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster();surface.updateMatrixWorld();
function front(x,y,offset=0){ray.set(new T.Vector3(x,y,.9),new T.Vector3(0,0,-1));return Math.max(ray.intersectObject(surface)[0]?.point.z??.20,y>3.36?.17:-1)+offset;}
const weights=p=>binding.front(p.x,p.y).weights;
function attach(g,name,color){const mesh=new T.SkinnedMesh(g,new T.MeshStandardMaterial({color,roughness:.92,side:T.DoubleSide}));mesh.name='Apparel_collar-shirt_'+name;body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);meshes.push(mesh);}
attach(shell,'cloth','#e5e1d7');

attach(cuffGeometry,'cuffs','#ece8df');

const pp=[],pi=[];for(let i=0;i<=14;i++){const y=T.MathUtils.lerp(2.265,3.26,i/14);for(const x of [-.026,.026])pp.push(x,y,front(x,y,.006));if(i)pi.push((i-1)*2,(i-1)*2+1,i*2,(i-1)*2+1,i*2+1,i*2);}const placket=new T.BufferGeometry();placket.setAttribute('position',new T.Float32BufferAttribute(pp,3));placket.setIndex(pi);bindGeometry(placket,weights);attach(placket,'placket','#d5d0c5');

// Crisp independent single-surface collar leaves; no folded stack of faces.
const collars=[];for(const sign of [-1,1]){const outline=[[.015,3.36],[.145,3.37],[.275,3.31],[.11,3.17]],pos=outline.flatMap(([x,y])=>[sign*x,y,.225+.55*(3.37-y)]),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(sign>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);bindGeometry(g,weights);collars.push(g);}attach(mergeGeometries(collars,false),'collar','#f0ede5');
const buttons=[];for(const y of [2.39,2.61,2.83,3.05]){const g=new T.SphereGeometry(.018,10,5);g.scale(1,1,.40);g.translate(0,y,front(0,y,.016));bindGeometry(g,weights);buttons.push(g);}attach(mergeGeometries(buttons,false),'buttons','#b9ad93');

const triangles=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0);root.userData.apparel={id:'collar-shirt',label:'翻领长袖衬衫',source:'procedural-current-body-shell-2026-09-20',triangles,status:'authored-tryon',open:false,sleeveless:false,method:'current 48-bone body shell, close shoulder and gently flared sleeve'};
root.updateMatrixWorld(true);body.skeleton.update();await fs.mkdir(output,{recursive:true});await saveGlb(root,`${output}/collar-shirt-rig.glb`);const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${output}/collar-shirt-only.glb`);await fs.copyFile(`${output}/collar-shirt-rig.glb`,'public/room3d/wardrobe/collar-shirt-rig.glb');console.log(JSON.stringify({triangles,drawCalls:meshes.length,vertices:shell.attributes.position.count},null,2));
