import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';

const id='maid-sleeves',out='output/cardigan-controller/procedural-basics';await fs.mkdir(out,{recursive:true});
// Exported by output/clothing-rebuild-0920/export-current-body.html from the
// same createBlankBody + bindBlankBody(..., true) used by the live wardrobe.
// Tight sleeves must retain its forearm-twist chain, not older 42-bone weights.
const bytes=await fs.readFile('output/clothing-rebuild-0920/wardrobe-current-body.glb');
const root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;root.updateMatrixWorld(true);const body=root.getObjectByName('Mesh_0'),skeleton=body.skeleton,g=body.geometry,bone=n=>skeleton.bones.findIndex(b=>b.name===n);
const wristShift=skeleton.bones[bone('L_hand')].getWorldPosition(new T.Vector3()).x-1.395465970792144;
const pos=g.attributes.position,normal=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,ray=new T.Raycaster();
const surface=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.updateMatrixWorld();
const white=[],black=[];
function unit(entries){const map=new Map();for(const[j,w]of entries)map.set(j,(map.get(j)??0)+w);const a=[...map].filter(e=>e[1]>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=a.reduce((s,e)=>s+e[1],0);return Array.from({length:4},(_,i)=>[a[i]?.[0]??0,(a[i]?.[1]??0)/sum]);}
function sourceVertex(i){const weights=[];for(let j=0;j<4;j++){let id=si.getComponent(i,j),w=sw.getComponent(i,j);const name=skeleton.bones[id].name;if(/thumb|index|middle|ring|pinky/.test(name))id=bone(name[0]+'_hand');weights.push([id,w]);}return{p:new T.Vector3().fromBufferAttribute(pos,i),n:new T.Vector3().fromBufferAttribute(normal,i),weights:unit(weights)};}
function lerp(a,b,t){return{p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),weights:unit([...a.weights.map(([j,w])=>[j,w*(1-t)]),...b.weights.map(([j,w])=>[j,w*t])])};}
function clip(poly,distance){const out=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a.p),db=distance(b.p);if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(lerp(a,b,da/(da-db)));}return out;}
function geometry(vertices,indices){const p=[],n=[],j=[],w=[];for(const v of vertices){p.push(...v.p.toArray());if(v.n)n.push(...v.n.toArray());for(const[id,value]of v.weights){j.push(id);w.push(value);}}const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(p,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(j,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));if(n.length===p.length)result.setAttribute('normal',new T.Float32BufferAttribute(n,3));result.setIndex(indices);if(!result.attributes.normal)result.computeVertexNormals();return result;}
function hitAt(sign,x,a){const origin=new T.Vector3(sign*(x+wristShift),3.125,.01),direction=new T.Vector3(0,Math.cos(a),Math.sin(a));ray.set(origin,direction);ray.far=.7;const hit=ray.intersectObject(surface)[0];if(!hit)throw Error(`Missing forearm surface ${sign}/${x}/${a}`);const ids=[hit.face.a,hit.face.b,hit.face.c],v=ids.map(sourceVertex),bary=T.Triangle.getBarycoord(hit.point,...v.map(v=>v.p),new T.Vector3()).toArray();const weights=unit(v.flatMap((v,k)=>v.weights.map(([j,w])=>[j,w*bary[k]])));return {p:hit.point,n:direction,weights};}
for(const sign of [-1,1]){
 // Exact reference-body triangles are clipped at both sleeve openings, then
 // offset along their smooth surface normals. The skinning is interpolated
 // from the same body, so tight cloth follows the wrist without finger pulls.
 const vertices=[],indices=[];
 for(let t=0;t<g.index.count;t+=3){let poly=[0,1,2].map(k=>sourceVertex(g.index.getX(t+k)));if(poly.some(v=>v.p.y<2.80||v.p.y>3.40))continue;poly=clip(poly,p=>sign*p.x-(.94+wristShift));if(!poly.length)continue;poly=clip(poly,p=>1.34+wristShift-sign*p.x);for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]]){indices.push(vertices.length);vertices.push({...v,p:v.p.clone().addScaledVector(v.n,.018)});}}
 white.push(mergeVertices(geometry(vertices,indices),1e-5));
 function ring(levels,material){const vertices=[],indices=[],segments=32;for(const[x,offset,wave,xwave=0]of levels)for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments,v=hitAt(sign,x,a),r=offset+wave*(.5+.5*Math.cos(a*8));v.p.addScaledVector(v.n,r);v.p.x+=sign*xwave*Math.cos(a*8);vertices.push(v);}for(let k=0;k<levels.length-1;k++)for(let i=0;i<segments;i++){const j=(i+1)%segments,a=k*segments+i,b=(k+1)*segments+i;indices.push(a,k*segments+j,b,k*segments+j,(k+1)*segments+j,b);}material.push(geometry(vertices,indices));}
 ring([[1.31,.019,0],[1.335,.035,.008,.004],[1.365,.058,.020,.009],[1.385,.061,.028,.017],[1.387,.053,.026,.017]],white);
 ring([[1.235,.025,0],[1.27,.025,0]],black);
 // A readable small bow sits on the wrist's front face, with no fingertip
 // influence. Keep the two loops and knot smooth and light on triangles.
 const anchor=hitAt(sign,1.252,Math.PI*.5),weights=anchor.weights;
 for(const[y,scale]of [[-.045,[.027,.05,.014]],[.045,[.027,.05,.014]],[0,[.022,.023,.020]]]){
  const bow=new T.SphereGeometry(1,8,4).scale(...scale).translate(anchor.p.x,anchor.p.y+y,anchor.p.z+.041),p=bow.attributes.position,j=[],w=[];for(let i=0;i<p.count;i++)for(const[id,value]of weights){j.push(id);w.push(value);}bow.setAttribute('skinIndex',new T.Uint16BufferAttribute(j,4));bow.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));bow.deleteAttribute('uv');black.push(bow);
 }
}
const meshes=[];for(const[parts,name,color]of[[white,'white_shell_and_ruffles','#f0ece4'],[black,'black_ribbon_bows','#17171b']]){
 const geometry=mergeGeometries(parts,false);geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({name:'maid_'+name,color,roughness:.88,side:T.DoubleSide}));mesh.name=`Apparel_${id}_${name}`;body.parent.add(mesh);mesh.bind(skeleton,body.bindMatrix);meshes.push(mesh);
}
const meta={id,label:'女仆手袖',slot:'accessory',sleeveOnly:true,asset:id+'-rig.glb',prefix:'Apparel_',triangles:meshes.reduce((s,m)=>s+m.geometry.index.count/3,0),drawCalls:2,status:'standalone-tryon',construction:'body-surface-offset',offset:.018,forearmRange:[.94+wristShift,1.387+wristShift]};root.userData.apparel=meta;
await saveGlb(root,`${out}/${id}-rig.glb`);const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${out}/${id}-only.glb`);await fs.copyFile(`${out}/${id}-rig.glb`,`public/room3d/wardrobe/${id}-rig.glb`);await fs.writeFile(`${out}/manifest-sleeves.json`,JSON.stringify([meta],null,2));console.log(meta);
