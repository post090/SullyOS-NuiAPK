import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';
import {createHash} from 'node:crypto';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original sculpted accessories, authored in the current 48-bone rest space.
// Reference silhouettes: pointed cat ears, rounded drop dog ears, tall fox
// ears and a full tapered brush. No downloaded geometry or textures.
const source=await fs.readFile('public/room3d/wardrobe/original-outfit.glb');
const scene=(await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'')).scene;
scene.updateMatrixWorld(true);let base;scene.traverse(o=>{if(o.isSkinnedMesh)base??=o;});
if(!base||base.skeleton.bones.length<48)throw Error('Current wardrobe skeleton required');
const skeleton=base.skeleton,root=new T.Group();
root.add(skeleton.bones[0]);root.updateMatrixWorld(true);
const manifest=[],colors={};
// Keep the user's imported replacements when rebuilding the procedural tails.
const importedEars=JSON.parse(await fs.readFile('art/chibi/animal-accessories.json','utf8')).filter(d=>d.slot==='ears'&&d.asset!=='animal-accessories.glb');
const palettes={cat:['#48434e','#ba8d96'],dog:['#966342','#ba947c'],fox:['#b87542','#dbb496'],rabbit:['#eee5df','#cf9da8']};
function add(id,geometry,part,color,bone){
 const count=geometry.attributes.position.count,joints=[],weights=[],index=skeleton.bones.findIndex(b=>b.name===bone);
 if(!geometry.index)geometry.setIndex(Array.from({length:count},(_,i)=>i));
 for(let i=0;i<count;i++){joints.push(index,0,0,0);weights.push(1,0,0,0);}
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({name:`${id}_${part}`,color,roughness:1,side:T.DoubleSide,vertexColors:!!geometry.attributes.color}));mesh.name=`Animal_${id}_${part}`;root.add(mesh);mesh.bind(skeleton,base.bindMatrix);
}

// Closed pinna with a rolled lip, recessed concha and a convex rear shell.
// The two materials meet on a shared curved surface, not stacked flat shapes.
function sculptEar(kind,side,inner){
 const dog=kind==='dog',fox=kind==='fox',rabbit=kind==='rabbit',shape=new T.Shape();
 if(rabbit){shape.moveTo(-.12,-.10);shape.bezierCurveTo(-.24,.28,-.23,1.17,-.08,1.30);shape.bezierCurveTo(.10,1.45,.24,1.02,.21,.67);shape.bezierCurveTo(.20,.34,.14,.06,.12,-.10);shape.quadraticCurveTo(0,-.17,-.12,-.10);}
 else if(dog){shape.moveTo(-.15,0);shape.bezierCurveTo(-.23,-.16,-.23,-.49,-.13,-.64);shape.bezierCurveTo(.02,-.77,.25,-.61,.24,-.40);shape.bezierCurveTo(.23,-.15,.13,.06,-.15,0);}
 else {const h=fox?.77:.43,w=fox?.29:.28;shape.moveTo(-w,0);shape.bezierCurveTo(-w*.95,h*.36,-.11,h*.86,-.035,h);shape.bezierCurveTo(.015,h*1.07,.06,h*.93,.095,h*.8);shape.bezierCurveTo(w*.65,h*.42,w*1.12,.10,w,0);shape.quadraticCurveTo(0,-.12,-w,0);}
 const outline=shape.getSpacedPoints(48).slice(0,-1),N=outline.length,center=new T.Vector2(dog?.025:0,dog?-.28:rabbit?.57:.17),positions=[],colors=[],indices=[];
 const rings=inner?[0,.15,.32,.49,.64]:[.64,.78,.90,1];
 const front=(r)=>dog?.08+.10*Math.sin(r*Math.PI):-.04+.19*Math.sin(r*Math.PI/2)**2;
 const put=(r,i,back=false)=>{
  const edge=outline[i],q=center.clone().lerp(edge,r);let z=back?-.16-.07*(1-r*r):front(r);
  if(dog)z+=.14*Math.sin((-q.y/.68)*Math.PI)-.12*(-q.y/.68)**2;
  // A slight outward lean and rearward tip avoids vertical antenna silhouettes.
  const x=dog?q.x+.20*(-q.y/.68):q.x+.15*q.y,zTilt=dog?0:-.12*q.y;
  positions.push(side*(x+(dog?.73:fox?.36:rabbit?.34:.57)),q.y+(dog?4.64:4.54),z+zTilt+(dog?.12:.02));
  const shade=back?.88:inner?(.66+.28*r/.64):(.87+.13*Math.sin(r*Math.PI));colors.push(shade,shade,shade);
 };
 const ring=(r,back=false)=>{const offset=positions.length/3;for(let i=0;i<N;i++)put(r,i,back);return offset;};
 const bridge=(a,b,reverse=false)=>{for(let i=0;i<N;i++){const j=(i+1)%N;const tri=[a+i,b+i,a+j,b+i,b+j,a+j];if(reverse)for(let k=0;k<tri.length;k+=3)[tri[k],tri[k+2]]=[tri[k+2],tri[k]];indices.push(...tri);}};
 const frontRings=rings.map(r=>ring(r));for(let k=1;k<frontRings.length;k++)bridge(frontRings[k-1],frontRings[k]);
 if(!inner){const backRings=[1,.75,.4,0].map(r=>ring(r,true));bridge(frontRings.at(-1),backRings[0]);for(let k=1;k<backRings.length;k++)bridge(backRings[k-1],backRings[k]);}
 if(side<0)for(let i=0;i<indices.length;i+=3)[indices[i],indices[i+2]]=[indices[i+2],indices[i]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function tailGeometry(kind){
 const fox=kind==='fox',cat=kind==='cat';
 const points=cat?[[0,2.18,-.24],[.15,1.87,-.55],[.55,1.45,-.67],[.95,1.57,-.66],[1.02,1.95,-.65],[.86,2.12,-.63]]:fox?[[0,2.18,-.24],[.17,1.95,-.60],[.60,1.59,-.83],[1.06,1.63,-.79],[1.25,1.98,-.64]]:[[0,2.18,-.24],[.12,2.21,-.54],[.40,2.53,-.73],[.70,2.64,-.64],[.79,2.48,-.52]];
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),steps=48,sides=16,frames=curve.computeFrenetFrames(steps,false),positions=[],colors=[],main=[],tip=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps,c=curve.getPointAt(t),roundEnd=Math.sqrt(Math.max(0,1-((Math.max(0,t-.94))/.06)**2));
  const radius=fox?(.045+.27*Math.sin(Math.PI*t)**.85)*(1-.75*t**8):cat?.087*roundEnd:(.095+.045*Math.sin(Math.PI*t))*(1-.7*t**5)*roundEnd;
  for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;
   const seamT=fox?t+.035*Math.sin(a*3)*Math.sin(Math.PI*t):t;const shifted=curve.getPointAt(seamT);
   const fur=cat?1:1+.10*Math.cos(a*5-t*9)*Math.sin(Math.PI*t)+.04*Math.sin(a*8+t*15)*Math.sin(Math.PI*t);
   const r=Math.max(.002,radius*fur),v=shifted.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r*(fox?.86:1));
   positions.push(...v.toArray());const shade=.89+.11*Math.cos(a-.7);colors.push(shade,shade,shade);
  }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;
  // Jagged white brush follows several small fur lobes instead of a straight ring.
  const boundary=fox?34/48:cat?.91:.80;
  (i/steps>=boundary?tip:main).push(a,b,a+1,b,b+1,a+1);
 }
 for(let j=1;j<sides;j++)main.push(0,j+1,j);
 for(let j=1;j<sides;j++)tip.push(steps*(sides+1),steps*(sides+1)+j,steps*(sides+1)+j+1);
 const make=(idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex([...main,...tip]);g.computeVertexNormals();g.setIndex(idx);return g;};
 const pieces=[make(main),make(tip)];
 if(fox){const clumps=[[],[]];for(const t of [.30,.46,.61,.80])for(const a of [0,Math.PI]){
  const i=Math.round(t*steps),c=curve.getPointAt(t),tangent=curve.getTangentAt(t),radial=new T.Vector3(-tangent.y,tangent.x,0).normalize().multiplyScalar(Math.cos(a)),across=new T.Vector3().crossVectors(tangent,radial).normalize();
  const radius=(.045+.27*Math.sin(Math.PI*t)**.85)*(1-.75*t**8),basePoint=c.clone().addScaledVector(radial,radius*.65),tipPoint=c.clone().addScaledVector(radial,radius+.04).addScaledVector(tangent,.14);
  const vertices=[basePoint.clone().addScaledVector(tangent,.11),basePoint.clone().addScaledVector(across,-.045),basePoint.clone().addScaledVector(tangent,-.11),tipPoint,basePoint.clone().addScaledVector(across,.045)];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(p=>p.toArray()),3));g.setAttribute('color',new T.Float32BufferAttribute(vertices.flatMap(()=>[.95,.95,.95]),3));g.setIndex([0,1,4,1,2,4,2,3,4,3,0,4,0,3,2,0,2,1]);g.computeVertexNormals();clumps[t>.7?1:0].push(g);
 }for(let k=0;k<2;k++){const old=pieces[k];pieces[k]=mergeGeometries([old,...clumps[k]],false);old.dispose();clumps[k].forEach(g=>g.dispose());}}
 return pieces;
}
function rabbitTail(){
 const g=new T.SphereGeometry(1,32,24),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),a=Math.atan2(v.z,v.x),b=Math.acos(T.MathUtils.clamp(v.y,-1,1));const fluff=1+.045*Math.sin(b*7)*Math.cos(a*9);v.multiplyScalar(fluff);p.setXYZ(i,v.x*.27,v.y*.26+2.06,v.z*.25-.51);}
 g.computeVertexNormals();return g;
}
for(const [kind,label] of [['cat','猫'],['dog','狗'],['fox','狐狸'],['rabbit','兔']])for(const slot of ['ears','tail']){
 const id=`${kind}-${slot}`,[fur,accent]=palettes[kind];
 if(slot==='ears')for(const side of [-1,1])for(const inner of [false,true])add(id,sculptEar(kind,side,inner),`${side}_${inner?'inner':'fur'}`,inner?accent:fur,'head');
 else if(kind==='rabbit')add(id,rabbitTail(),'fur',fur,'hips');
 else {const [main,tip]=tailGeometry(kind);add(id,main,'fur',fur,'hips');add(id,tip,'tip',kind==='cat'?'#665f72':kind==='fox'?'#f2e4ce':'#d9c2a4','hips');}
 manifest.push({id,label:label+(slot==='ears'?'耳':'尾'),slot,asset:'animal-accessories.glb',prefix:`Animal_${id}_`});
}
await saveGlb(root,'public/room3d/wardrobe/animal-accessories.glb');
// Exporter material order is authoritative for independent color regions.
const bytes=await fs.readFile('public/room3d/wardrobe/animal-accessories.glb'),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),revision=createHash('sha256').update(bytes).digest('hex').slice(0,12);
for(const d of manifest){d.revision=revision;colors[d.id]=['fur',d.slot==='ears'?'inner':'tip'].map(part=>({id:part,label:part==='fur'?'毛色':part==='inner'?'耳内':'尾尖',color:part==='fur'?palettes[d.id.split('-')[0]][0]:d.slot==='tail'?(d.id==='cat-tail'?'#665f72':d.id==='fox-tail'?'#f2e4ce':'#d9c2a4'):palettes[d.id.split('-')[0]][1],targets:json.materials.flatMap((m,i)=>m.name.startsWith(d.id+'_')&&m.name.endsWith('_'+part)?[{material:i}]:[])}));}
colors['rabbit-tail']=colors['rabbit-tail'].filter(region=>region.targets.length);
for(const entry of importedEars){Object.assign(manifest.find(d=>d.id===entry.id),entry);delete colors[entry.id];}
await fs.writeFile('art/chibi/animal-accessories.json',JSON.stringify(manifest,null,2));
for(const [path,update] of [
 ['apps/room3d/chibi/approvedWardrobe.json',v=>[...v.filter(d=>!manifest.some(m=>m.id===d.id)),...manifest]],
 ['apps/room3d/chibi/wardrobeColorRegions.json',v=>({...v,...colors})],
 ['apps/room3d/chibi/wardrobeLayering.json',v=>({...v,garments:{...v.garments,...Object.fromEntries(manifest.map(d=>[d.id,'separate']))}})]])await fs.writeFile(path,JSON.stringify(update(JSON.parse(await fs.readFile(path,'utf8'))),null,2));
console.log('Published',manifest.map(d=>d.id).join(', '),bytes.length,'bytes');
