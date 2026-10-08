import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';
import {reference,openEnds,sliceBands} from './clothing-import-utils.mjs';
import {surfaceBinding,apronStraps,bootLaces,neckwear,rebuildBootShaft} from './clothing-details.mjs';

// Only independent footwear from 044506 is retained. The skirts, shoes and
// socks supplied with uniforms in 055133 are deliberately excluded.
const inventory=[
 ['044506','01a0bd20-c121-76f6-a505-b58a75eeb76b'],
 ['044506','01a0bd20-c132-724d-b62f-56936311e023'],
 ['044506','01a0bd20-c196-7047-afa8-51a88b7fb5ea'],
 ['055133','01a0bd4d-05e2-71d9-9275-7cf6deb318bc'],
 ['055133','01a0bd4d-05ee-7744-b221-8f8afb8cd825'],
 ['055133','01a0bd4d-0615-723e-b06a-bbc9ebccc8eb'],
 ['055133','01a0bd4d-063e-73f3-a939-9a1131d9bf73'],
 ['055133','01a0bd4d-0640-756d-91ee-40b9b1c06d87'],
 ['055133','01a0bd5d-5b39-7446-862c-c784d33da7a3'],
].map(([pack,folder],i)=>({id:i+1,pack,folder}));
const definitions=[
 {id:'lace-midboots',source:1,label:'系带中筒靴',parts:[1,2],shoe:true,opening:.955,colors:['#777783','#e6ded2','#514d59']},
 {id:'buckle-shoes',source:2,label:'搭扣低帮鞋',parts:[0,1,2,3,4,5,6],shoe:true,opening:.385,colors:['#675967','#cabcb3']},
 {id:'tall-boots',source:3,label:'简洁长靴',parts:[1,2],shoe:true,opening:1.10,colors:['#89796f']},
 {id:'collar-shirt',source:4,label:'翻领长袖衬衫',parts:[0],colors:['#e1ddd4']},
 {id:'belt-coat',source:5,label:'系带长外套',parts:[0,7,8,11,12,13,14],colors:['#bbae9a','#72665f'],long:true},
 {id:'ruffle-apron',source:6,label:'荷叶边围裙',parts:[1,2,3,4,5,10,13,14],colors:['#e8e1d6','#b7a5b7'],sleeveless:true},
 {id:'bow-headband',source:6,label:'蝴蝶结头饰',parts:[6,7,8,9,11,12],colors:['#e3d9dc'],head:true},
 {id:'school-blazer',source:7,label:'蝴蝶结制服外套',parts:[0,9,10,11,12,13],colors:['#68788b','#ac8690']},
 {id:'stand-collar',source:8,label:'立领制服上衣',parts:[1,9,10,11,12,13,14],colors:['#58636c','#c9b793']},
 {id:'hood-parka',source:9,label:'连帽宽松外套',parts:[1,6,7,8,9,10,11,12,13,...Array.from({length:12},(_,i)=>14+i)],colors:['#98a295','#dfd9c9'],open:true},
 {id:'necktie',label:'经典领带',parts:[],colors:['#67778e'],accessory:true},
 {id:'bow-tie',label:'蝴蝶领结',parts:[],colors:['#a57586'],accessory:true},
];
const out='output/cardigan-controller/clothing-0920b';await fs.mkdir(out,{recursive:true});
const v=new T.Vector3(),ray=new T.Raycaster();
const clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep;
function weightArray(list){const total=list.reduce((n,[,w])=>n+w,0);return Array.from({length:4},(_,i)=>[list[i]?.[0]??0,(list[i]?.[1]??0)/total]);}
function nearestWeights(point,points,body){
 const nearest=[];for(let i=0;i<points.length;i++){const d=point.distanceToSquared(points[i]);let at=nearest.findIndex(n=>d<n.d);if(at<0)at=nearest.length;if(at<4){nearest.splice(at,0,{i,d});nearest.length=Math.min(nearest.length,4);}}
 const map=new Map(),si=body.geometry.attributes.skinIndex,sw=body.geometry.attributes.skinWeight;
 for(const {i,d} of nearest)for(let k=0;k<4;k++){const j=si.array[i*4+k],w=sw.array[i*4+k]/Math.max(.00001,d);map.set(j,(map.get(j)??0)+w);}
 return weightArray([...map].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4));
}
function matrixFor(list,skeleton){const m=new T.Matrix4();m.elements.fill(0);for(const[j,w]of list){const a=new T.Matrix4().multiplyMatrices(skeleton.bones[j].matrixWorld,skeleton.boneInverses[j]);for(let k=0;k<16;k++)m.elements[k]+=w*a.elements[k];}return m;}
const manifest=[];
for(const def of definitions){
 if(process.argv[2]&&process.argv[2]!==def.id)continue;
 const item=inventory.find(i=>i.id===def.source);let source,parts;
 if(item){[source]=await readGeometry(`output/clothing-0920b/source/${item.pack}/${item.folder}/Meshy_AI_model.glb`);parts=splitParts(source);}
 const root=await reference(),body=root.getObjectByName('Mesh_0'),skeleton=body.skeleton,bone=name=>skeleton.bones.findIndex(b=>b.name===name);
 const binding=surfaceBinding(body);
 const rests=skeleton.bones.map(b=>b.quaternion.clone());
 if(!def.shoe&&!def.head&&!def.sleeveless&&!def.accessory)for(const side of ['L','R'])skeleton.bones[bone(side+'_upperArm')].rotation.z=(side==='L'?-1:1)*Math.PI*55/180;
 root.updateMatrixWorld(true);skeleton.update();
 const posed=[],bp=body.geometry.attributes.position;for(let i=0;i<bp.count;i++)posed.push(body.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(bp,i)));
 const posedGeometry=body.geometry.clone();posedGeometry.setAttribute('position',new T.Float32BufferAttribute(posed.flatMap(p=>p.toArray()),3));posedGeometry.computeVertexNormals();const surface=new T.Mesh(posedGeometry,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.updateMatrixWorld();
 const buckets=def.colors.map(()=>[]);
 for(const k of def.parts){let g=await compactGeometry(source,parts[k].ids);
  if(def.id==='buckle-shoes'&&k===0)g=openEnds(g,-1,-.418);
  if(def.id==='lace-midboots'||def.id==='tall-boots')g=openEnds(g,-1,.5/4.8-.5);
  if(def.id==='ruffle-apron'&&k===1)g=openEnds(g,-1,.12);
  if(def.id==='school-blazer'&&k===0){
   // The attached skirt is in the torso region only. A global Y cut would
   // also slice off the lower halves of the sloping sleeves.
   const pos=g.attributes.position,ids=g.index,torso=[],arms=[];
   for(let t=0;t<ids.count;t+=3){const tri=[ids.getX(t),ids.getX(t+1),ids.getX(t+2)],x=tri.reduce((s,i)=>s+pos.getX(i),0)/3;(Math.abs(x)<.115?torso:arms).push(...tri);}
   const a=await compactGeometry(g,arms),b=openEnds(await compactGeometry(g,torso),-.043,1);a.deleteAttribute('normal');g=mergeVertices(mergeGeometries([a,b],false),1e-5);
  }
  if(def.long&&k===0)g=sliceBands(g,[-.025,-.10,-.175,-.25,-.325]);
  const p=g.attributes.position,joints=[],weights=[],shoeSides=new Int8Array(p.count);
  if(def.shoe)for(const part of splitParts(g))for(const i of part.ids)shoeSides[i]=part.center.x<0?-1:1;
  for(let i=0;i<p.count;i++){
   const sx=p.getX(i),sy=p.getY(i),sz=p.getZ(i),sign=def.shoe?shoeSides[i]:(sx<0?-1:1),side=sign<0?'R':'L';let list;
   if(def.shoe){
    v.set(sign*.2595+(sx-sign*.045)*4.2,(sy+.5)*4.8,sz*3.65-.035);
    // Preserve the boot's inner/outer wall separation. Projecting both walls
    // onto the same ankle radius collapses them and causes flickering triangles.
    const widening=1+.20*smooth(v.y,.22,.55);
    v.x=sign*.2595+(v.x-sign*.2595)*widening;
    v.z=.025+(v.z-.025)*widening;
    list=binding.leg(v,sign);
   }else if(def.head){v.set(sx*4.9,4.03+(sy-.33)*5.05,sz*5.3);list=weightArray([[bone('head'),1]]);}
   else {
    v.set(sx*5.3,2.325+sy*5,sz*(def.id==='collar-shirt'?5.8:5.1));
    // The current doll's shoulders are higher than the source A-pose human's.
    // Raise only the shoulder crown, keeping the collar centre and cuffs fixed.
    if(!def.sleeveless)v.y+=.14*smooth(Math.abs(v.x),.08,.24)*(1-smooth(Math.abs(v.x),.50,.80))*smooth(v.y,2.9,3.2);
    // Use continuous torso/arm sections, rather than individual source vertex
    // normals: pushing against nearest vertices makes a smooth shirt lumpy.
    const origin=new T.Vector3(0,v.y,.005);
    if(!def.sleeveless&&Math.abs(v.x)>.44&&v.y>1.85){
     const shoulder=skeleton.bones[bone(side+'_upperArm')].getWorldPosition(new T.Vector3()),hand=skeleton.bones[bone(side+'_hand')].getWorldPosition(new T.Vector3()),axis=hand.sub(shoulder).normalize();
     origin.copy(shoulder).addScaledVector(axis,clamp(v.clone().sub(shoulder).dot(axis),0,1.28));
    }
    const delta=v.clone().sub(origin),radius=delta.length();
    if(def.id!=='collar-shirt'&&radius>.005&&v.y>2.0&&v.y<3.12){ray.set(origin,delta.normalize());ray.far=.85;const hit=ray.intersectObject(surface)[0];if(hit&&hit.distance+.045>radius)v.copy(origin).addScaledVector(delta,hit.distance+.045);}
    list=nearestWeights(v,posed,body);
    // A flared cuff can hang below waist height. Its location alone must never
    // switch it to hips, and fingers must not pull a sleeve when curling.
    const mapped=new Map();for(let[j,w]of list){const name=skeleton.bones[j].name;if(/thumb|index|middle|ring|pinky/.test(name))j=bone(name[0]+'_hand');mapped.set(j,(mapped.get(j)??0)+w);}list=weightArray([...mapped].sort((a,b)=>b[1]-a[1]).slice(0,4));
    const armWeighted=list.some(([j,w])=>w>.1&&/_(upperArm|forearm|hand|twist)/.test(skeleton.bones[j].name));
    if(v.y<2.15&&!armWeighted){
     if(def.long){const leg=1-smooth(v.y,1.75,2.15),shin=1-smooth(v.y,.8,1.23);list=weightArray([[bone('hips'),1-leg],[bone(side+'_thigh'),leg*(1-shin)],[bone(side+'_shin'),leg*shin]]);}
     else list=weightArray([[bone('hips'),1]]);
    }
    if(def.open&&[7,8,10,11,12,13,...Array.from({length:12},(_,i)=>14+i)].includes(k)&&v.y<2.2)list=weightArray([[bone('hips'),1]]);
    v.applyMatrix4(matrixFor(list,skeleton).invert());
   }
   p.setXYZ(i,v.x,v.y,v.z);for(const[j,w]of list){joints.push(j);weights.push(w);}
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.computeVertexNormals();
  let color=0;if(def.colors.length>1){if(def.shoe)color=k>(def.source===1?2:0)?1:0;else color=k===def.parts[0]?0:1;}buckets[color].push(g);
 }
 if(def.id==='ruffle-apron')buckets[0].push(apronStraps(binding));
 if(def.id==='lace-midboots'||def.id==='tall-boots')buckets[0]=rebuildBootShaft(buckets[0],binding,def.id==='tall-boots'?1.248:.984);
 if(def.id==='lace-midboots'){const [laces,eyelets]=bootLaces(buckets[0],binding);buckets[1].push(laces);buckets[2].push(eyelets);}
 if(def.accessory)buckets[0].push(neckwear(def.id,binding));
 // Source sleeves often extend over the palm. Fit their rest-pose cuff length
 // to this doll's wrist, leaving the hand outside instead of poking through.
 if(!def.shoe&&!def.head&&!def.sleeveless&&!def.accessory){
  let reach=0;for(const geos of buckets)for(const g of geos){const p=g.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>2.65)reach=Math.max(reach,Math.abs(p.getX(i)));}
  if(reach>1.38){const factor=(1.37-.65)/(reach-.65),restPoints=Array.from({length:bp.count},(_,i)=>new T.Vector3().fromBufferAttribute(bp,i));
   for(const geos of buckets)for(const g of geos){const p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
    for(let i=0;i<p.count;i++)if(p.getY(i)>2.65&&Math.abs(p.getX(i))>.65){p.setX(i,Math.sign(p.getX(i))*(.65+(Math.abs(p.getX(i))-.65)*factor));v.fromBufferAttribute(p,i);const mapped=new Map();for(let[j,w]of nearestWeights(v,restPoints,body)){const name=skeleton.bones[j].name;if(/thumb|index|middle|ring|pinky/.test(name))j=bone(name[0]+'_hand');mapped.set(j,(mapped.get(j)??0)+w);}const list=weightArray([...mapped].sort((a,b)=>b[1]-a[1]).slice(0,4));for(let n=0;n<4;n++){si.array[i*4+n]=list[n][0];sw.array[i*4+n]=list[n][1];}}
    g.computeVertexNormals();
   }
  }
 }
 skeleton.bones.forEach((b,i)=>b.quaternion.copy(rests[i]));root.updateMatrixWorld(true);skeleton.update();
 const meshes=[];for(const[i,geos]of buckets.entries())if(geos.length){const g=mergeGeometries(geos,false);g.computeBoundingBox();const m=new T.SkinnedMesh(g,new T.MeshStandardMaterial({color:def.colors[i],roughness:.88,side:T.DoubleSide}));m.name=(def.shoe?'Footwear_':'Apparel_')+def.id+'_'+i;body.parent.add(m);m.bind(skeleton,body.bindMatrix);meshes.push(m);}
 const meta={id:def.id,label:def.label,pack:item?.pack??'procedural',folder:item?.folder??'',triangles:meshes.reduce((s,m)=>s+m.geometry.index.count/3,0),drawCalls:meshes.length,status:'standalone-tryon',head:!!def.head,open:!!def.open,sleeveless:!!def.sleeveless,accessory:!!def.accessory};
 if(def.shoe){meta.opening=def.opening;meta.groundOffset=0;root.userData.footwear=meta;}
 else {
  meta.coveredBodyTriangles=[];
  if(!def.head&&!def.sleeveless&&!def.accessory){
   const hem=def.long?.32:def.id==='school-blazer'?2.22:def.open?1.82:2.17,idx=body.geometry.index;
   for(let i=0;i<idx.count;i+=3){const c=new T.Vector3();for(let k=0;k<3;k++)c.add(new T.Vector3().fromBufferAttribute(bp,idx.getX(i+k)));c.multiplyScalar(1/3);
    const arm=Math.abs(c.x)>.27&&Math.abs(c.x)<1.29&&c.y>2.80&&c.y<3.25;
    const neckline=def.id==='collar-shirt'?3.31:3.23;
    const torso=Math.abs(c.x)<.45&&c.y>hem&&c.y<neckline&&(!def.long||c.y<3.05||Math.abs(c.x)>.18)&&(!def.open||c.z<-.06);
    if(arm||torso)meta.coveredBodyTriangles.push(i/3);
   }
  }
  root.userData.apparel=meta;
 }
 await saveGlb(root,`${out}/${def.id}-rig.glb`);
 const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const n=new T.Mesh(g,m.material);n.name=m.name;only.add(n);}await saveGlb(only,`${out}/${def.id}-only.glb`);
 manifest.push(meta);console.log(meta.id,meta.triangles);
}
if(!process.argv[2])await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
