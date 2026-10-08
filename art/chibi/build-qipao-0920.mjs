import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {surfaceBinding,bindGeometry} from './clothing-details.mjs';
import {qipaoBodyShell} from './qipao-body-shell.mjs';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';

// Uploaded qipao silhouette reconstructed as a continuous shell in current T space. The torso and sleeves share each
// armhole vertex, so posing cannot expose a seam between independent shells.
const output='output/cardigan-controller/procedural-basics';
const currentBytes=await fs.readFile('output/clothing-rebuild-0920/wardrobe-current-body.glb');
const root=(await new GLTFLoader().parseAsync(currentBytes.buffer.slice(currentBytes.byteOffset,currentBytes.byteOffset+currentBytes.length),'')).scene,body=root.getObjectByName('Mesh_0'),binding=surfaceBinding(body);
const bone=binding.bone,smooth=T.MathUtils.smoothstep;
const weight=list=>{const items=list.filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=items.reduce((s,[,w])=>s+w,0);return Array.from({length:4},(_,i)=>[items[i]?.[0]??0,(items[i]?.[1]??0)/sum]);};
function torsoWeights(p){
 if(p.y<2.30){const leg=1-smooth(p.y,2.0,2.30),shin=1-smooth(p.y,.95,1.65),left=smooth(p.x,-.16,.16);return weight([[bone('hips'),1-leg],[bone('L_thigh'),leg*(1-shin)*left],[bone('R_thigh'),leg*(1-shin)*(1-left)],[bone('L_shin'),leg*shin*left],[bone('R_shin'),leg*shin*(1-left)]]);}
 const origin=new T.Vector3(0,p.y,.045),hit=binding.cast(origin,p.clone().sub(origin),.65);
 if(hit)return binding.weights(hit);
 const chest=smooth(p.y,2.45,3.07),hips=1-smooth(p.y,2.17,2.55);
 const upper=smooth(Math.abs(p.x),.20,.64)*smooth(p.y,2.82,3.06);
 return weight([[bone('hips'),hips*(1-upper)],[bone('spine'),(1-hips)*(1-chest)*(1-upper)],[bone('chest'),(1-hips)*chest*(1-upper)],[bone((p.x<0?'R':'L')+'_upperArm'),upper]]);
}
const {shell,cuffs:cuffGeometry}=qipaoBodyShell(body,torsoWeights);
const meshes=[];
function attach(geometry,name,color){const m=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide}));m.name='Apparel_qipao_'+name;body.parent.add(m);m.bind(body.skeleton,body.bindMatrix);meshes.push(m);return m;}
attach(shell,'cloth','#c9d8d2');

attach(cuffGeometry,'cuffs','#9baea5');

// Upright mandarin collar and a clear diagonal closure, based on the uploaded qipao.
const cp=[],ci=[],segments=32;
for(const[y,rx,rz]of [[3.393,.18,.146],[3.47,.176,.145],[3.47,.168,.137],[3.393,.172,.138]])for(let i=0;i<segments;i++){const a=i/segments*2*Math.PI;cp.push(rx*Math.sin(a),y,.026+rz*Math.cos(a));}
for(let r=0;r<3;r++)for(let i=0;i<segments;i++){const j=(i+1)%segments,a=r*segments+i,b=(r+1)*segments+i;ci.push(a,b,r*segments+j,b,(r+1)*segments+j,r*segments+j);}
const collar=new T.BufferGeometry();collar.setAttribute('position',new T.Float32BufferAttribute(cp,3));collar.setIndex(ci);bindGeometry(collar,torsoWeights);attach(collar,'standing_collar','#a1b8ad');
const shellSurface=new T.Mesh(shell,new T.MeshBasicMaterial({side:T.DoubleSide}));shellSurface.updateMatrixWorld();const frontRay=new T.Raycaster();function front(x,y){frontRay.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));return (frontRay.intersectObject(shellSurface)[0]?.point.z??.34)+.012;}
const curve=new T.CatmullRomCurve3([new T.Vector3(.01,3.38,.185),new T.Vector3(.18,3.26,.259),new T.Vector3(.28,3.05,.296),new T.Vector3(.31,2.75,.297),new T.Vector3(.34,2.5,.30)]);
for(const point of curve.points)point.z=front(point.x,point.y);const trim=new T.TubeGeometry(curve,24,.007,5,false);bindGeometry(trim,torsoWeights);attach(trim,'diagonal_trim','#61796f');
const knots=[];
for(const[x,y]of [[.11,3.31],[.25,3.09],[.31,2.83],[.34,2.57]]){
 const z=front(x,y);
 for(const dx of [-.019,.019]){const g=new T.TorusGeometry(.020,.006,4,10);g.scale(1.4,.62,1);g.translate(x+dx,y,z);bindGeometry(g,torsoWeights);knots.push(g);}
 const g=new T.SphereGeometry(.012,8,4);g.translate(x,y,z+.008);bindGeometry(g,torsoWeights);knots.push(g);
}
attach(mergeGeometries(knots,false),'frog_closures','#4d675b');
const triangles=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0);
const coveredBodyTriangles=[],bp=body.geometry.attributes.position,bi=body.geometry.index;
for(let i=0;i<bi.count;i+=3){
 const p=new T.Vector3();for(let k=0;k<3;k++)p.add(new T.Vector3().fromBufferAttribute(bp,bi.getX(i+k)));p.multiplyScalar(1/3);
 if((Math.abs(p.x)<.45&&p.y>1.68&&p.y<3.29)||(Math.abs(p.x)>.30&&Math.abs(p.x)<1.28&&p.y>2.86&&p.y<3.28))coveredBodyTriangles.push(i/3);
}
root.userData.apparel={id:'qipao',label:'盘扣长旗袍',source:'Meshy_AI_Blank_Chibi_Qipao_0920125742_texture.glb / rebuilt continuous shell',triangles,status:'authored-tryon',open:false,sleeveless:false,coveredBodyTriangles};
root.updateMatrixWorld(true);body.skeleton.update();
await fs.mkdir(output,{recursive:true});await saveGlb(root,`${output}/qipao-rig.glb`);
const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${output}/qipao-only.glb`);
await fs.copyFile(`${output}/qipao-rig.glb`,'public/room3d/wardrobe/qipao-rig.glb');
await fs.writeFile(output+'/manifest-qipao.json',JSON.stringify([{id:'qipao',label:'盘扣长旗袍',slot:'onepiece',triangles,drawCalls:meshes.length,open:false,sleeveless:false,source:'Meshy_AI_Blank_Chibi_Qipao_0920125742_texture.glb',prefix:'Apparel_'}],null,2));
console.log(JSON.stringify({triangles,drawCalls:meshes.length,vertices:shell.attributes.position.count,paths:[`${output}/qipao-rig.glb`,`${output}/qipao-only.glb`,'public/room3d/wardrobe/qipao-rig.glb']},null,2));
