import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {readGeometry,splitParts,compactGeometry,saveGlb} from '../jellyfish-home/asset-geometry.mjs';
import {reference} from './clothing-import-utils.mjs';

const id='hood-parka',out='output/cardigan-controller/clothing-0920b';
const backup='output/clothing-rebuild-0920/hood-before';await fs.mkdir(backup,{recursive:true});
for(const kind of ['rig','only']){const path=`${backup}/${id}-${kind}.glb`;try{await fs.access(path);}catch{await fs.copyFile(`${out}/${id}-${kind}.glb`,path);}}
const sourcePath='output/clothing-rebuild-0920/input/Meshy_AI_Porcelain_Drifter_0920125215_generate.glb';
const [source]=await readGeometry(sourcePath),parts=splitParts(source);
const root=await reference(),body=root.getObjectByName('Mesh_0'),skeleton=body.skeleton;
const bone=name=>skeleton.bones.findIndex(b=>b.name===name),smooth=T.MathUtils.smoothstep,clamp=T.MathUtils.clamp;
root.updateMatrixWorld(true);skeleton.update();
function normalized(entries){const list=entries.filter(([,w])=>w>1e-6).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=list.reduce((a,e)=>a+e[1],0);return Array.from({length:4},(_,i)=>[list[i]?.[0]??0,(list[i]?.[1]??0)/sum]);}
const buckets=[[],[],[]],partIds=[7,8,10,11,12,13,...Array.from({length:12},(_,i)=>i+14)];
const torsoLevels=[[1.65,.64,.47],[1.75,.63,.45],[2.05,.59,.39],[2.35,.52,.34],[2.65,.47,.33],[2.92,.47,.34],[3.13,.43,.31],[3.28,.35,.25]];
function section(y){let a=torsoLevels[0],b=torsoLevels.at(-1);for(let i=1;i<torsoLevels.length;i++)if(y<=torsoLevels[i][0]){a=torsoLevels[i-1];b=torsoLevels[i];break;}const t=clamp((y-a[0])/(b[0]-a[0]),0,1);return [T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t)];}
function skinGeometry(g,fn){const p=g.attributes.position,j=[],w=[];for(let i=0;i<p.count;i++){const list=normalized(fn(new T.Vector3().fromBufferAttribute(p,i)));for(const[k,v]of list){j.push(k);w.push(v);}}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(j,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));g.computeVertexNormals();return g;}
function torsoWeights(v){const hips=1-smooth(v.y,2.17,2.94);return [[bone('hips'),hips],[bone('chest'),1-hips]];}
function geo(pos,ids){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ids);return g;}
// User's charcoal / silver reference: paint existing cloth regions, without
// adding the generated reference's extra buckles, chains or badges.
const palette={cloth:'#343539',lining:'#656366',cuff:'#79767a',trim:'#89868a',patch:'#292a2d',pocket:'#3b3c40',metal:'#bfc1c5'};
function paint(g,colorAt){const p=g.attributes.position,n=g.attributes.normal,colors=[];for(let i=0;i<p.count;i++){const hex=typeof colorAt==='function'?colorAt(new T.Vector3().fromBufferAttribute(p,i),new T.Vector3().fromBufferAttribute(n,i)):colorAt;colors.push(...new T.Color(hex).toArray());}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;}
// Rebuild a continuous open coat and its two independent sleeve tubes directly
// in the skeleton's T rest space. This keeps every cuff ring on forearm bones
// and the entire hem on the torso, including during T pose and raised arms.
{
 const p=[],ix=[],segments=36;
 for(const[y,rx,rz]of torsoLevels)for(let i=0;i<=segments;i++){const a=.43+(Math.PI*2-.86)*i/segments;p.push(rx*Math.sin(a),y,.015+rz*Math.cos(a));}
 for(let k=0;k<torsoLevels.length-1;k++)for(let i=0;i<segments;i++){const a=k*(segments+1)+i,b=a+segments+1;ix.push(a,a+1,b,a+1,b+1,b);}
 buckets[0].push(skinGeometry(geo(p,ix),torsoWeights));
}
for(const sign of [-1,1]){
 const p=[],ix=[],n=24,levels=[[.25,.195,.235],[.39,.23,.26],[.54,.265,.275],[.72,.275,.29],[.90,.285,.30],[1.06,.29,.30],[1.12,.31,.32],[1.15,.35,.36],[1.20,.35,.36],[1.23,.32,.33],[1.28,.35,.36],[1.32,.35,.36],[1.36,.325,.33],[1.37,.315,.32],[1.35,.307,.312]];
 for(const[x,ry,rz]of levels)for(let i=0;i<n;i++){const a=i*Math.PI*2/n;p.push(sign*x,3.125+ry*Math.cos(a),.01+rz*Math.sin(a));}
 for(let k=0;k<levels.length-1;k++)for(let i=0;i<n;i++){const j=(i+1)%n,a=k*n+i,b=(k+1)*n+i;ix.push(a,k*n+j,b,k*n+j,(k+1)*n+j,b);}
 buckets[0].push(paint(skinGeometry(geo(p,ix),v=>{const x=Math.abs(v.x),fore=smooth(x,.72,1.02),chest=1-smooth(x,.25,.45),side=sign<0?'R':'L';return [[bone('chest'),chest],[bone(side+'_upperArm'),(1-chest)*(1-fore)],[bone(side+'_forearm'),(1-chest)*fore]];}),v=>Math.abs(v.x)>=1.145&&Math.abs(v.x)<=1.205?palette.cuff:palette.cloth));
 // The source badge crossed the elbow and folded through itself. Keep a
 // smaller readable raised patch on the upper sleeve, fully before the joint.
 const pp=[],pi=[],rows=5,cols=5;for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){const x=.57+.24*r/rows,a=.20+.98*c/cols,raise=.013+.012*Math.sin(r/rows*Math.PI);pp.push(sign*x,3.125+(.275+raise)*Math.cos(a),.01+(.29+raise)*Math.sin(a));}
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=r*(cols+1)+c,b=a+cols+1;pi.push(a,a+1,b,a+1,b+1,b);}
 buckets[1].push(paint(skinGeometry(geo(pp,pi),()=>[[bone((sign<0?'R':'L')+'_upperArm'),1]]),palette.patch));
}
// Retain the authored hood's outer silhouette and bowl, independently of the
// generated sleeve/torso bridge which caused the original broken deformation.
{
 const sp=source.attributes.position,ids=[];for(let k=0;k<parts[1].ids.length;k+=3){const tri=parts[1].ids.slice(k,k+3);const c=tri.reduce((v,i)=>v.add(new T.Vector3().fromBufferAttribute(sp,i)),new T.Vector3()).multiplyScalar(1/3);if(c.y>.146||(c.z<-.043&&c.y>.109))ids.push(...tri);}
 const hood=await compactGeometry(source,ids),p=hood.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*5.35,2.325+p.getY(i)*5.15,p.getZ(i)*5.18+.01);
 skinGeometry(hood,()=>[[bone('chest'),1]]);hood.computeBoundingBox();const center=hood.boundingBox.getCenter(new T.Vector3());
 buckets[0].push(paint(hood,(v,n)=>n.dot(v.clone().sub(center))<-.012?palette.lining:palette.cloth));
}
for(const part of partIds){
 const geometry=await compactGeometry(source,parts[part].ids),p=geometry.attributes.position,joints=[],weights=[];
 for(let i=0;i<p.count;i++){
  const sx=p.getX(i),sy=p.getY(i),sz=p.getZ(i),sign=sx<0?-1:1,side=sign<0?'R':'L',x=Math.abs(sx);
  // Source sleeve coordinates: along the original A-pose arm and across it.
  // One smooth sleeve/body partition drives BOTH fitting and skin weights.
  // This removes nearest-body switches to hips/fingers at the loose cuffs.
  const dx=x-.079,dy=sy-.130,t=dx*.545+dy*-.838,cross=dx*.838+dy*.545;
  let arm=smooth(cross,-.084,-.059)*smooth(x,.077,.110)*(1-smooth(sy,.125,.18));
  if(part===6||part===9)arm=1;
  if([7,8,10,11,12,13].includes(part)||part>=14)arm=0;
  const torso=new T.Vector3(sx*5.35,2.325+sy*5.15,sz*5.18+.010);
  // Preserve an open front with a straight, roomy body. The shoulders use the
  // doll's real upper-arm anchor while the original broad cuff shape survives.
  const along=t*5.20,across=cross*5.25;
  const sleeve=new T.Vector3(sign*(.305+along),3.125+across,sz*5.25+.010);
  const v=torso.lerp(sleeve,arm);
  const upperToFore=smooth(Math.abs(v.x),.72,1.02);
  const hips=1-smooth(v.y,2.17,2.94);
  const list=normalized([[bone('hips'),(1-arm)*hips],[bone('chest'),(1-arm)*(1-hips)],[bone(side+'_upperArm'),arm*(1-upperToFore)],[bone(side+'_forearm'),arm*upperToFore]]);
  p.setXYZ(i,v.x,v.y,v.z);
  for(const[j,w]of list){joints.push(j);weights.push(w);}
 }
 geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3()),offset=new T.Vector3();
 if(part>=14){const[rx,rz]=section(center.y);offset.set(Math.sign(center.x)*(rx*Math.sin(.43)+.026)-center.x,0,.015+rz*Math.cos(.43)+.018-center.z);}
 else if([10,12,13].includes(part)){const[rx,rz]=section(center.y);offset.z=.015+rz*Math.sqrt(Math.max(.10,1-(center.x/rx)**2))+.019-center.z;}
 else if(part===11)offset.x=-.12;
 else if(part===6||part===9){const cy=center.y-3.125,cz=center.z-.01,len=Math.hypot(cy,cz),target=.32;offset.y=cy*(target/len-1);offset.z=cz*(target/len-1);}
 geometry.translate(offset.x,offset.y,offset.z);
 // Each raised sleeve badge is a single patch. A shared local blend preserves
 // its plane instead of folding adjacent low-poly triangles across the elbow.
 if(part===6||part===9){const side=center.x<0?'R':'L',fore=smooth(Math.abs(center.x),.72,1.02),list=normalized([[bone(side+'_upperArm'),1-fore],[bone(side+'_forearm'),fore]]);for(let i=0;i<p.count;i++)for(let k=0;k<4;k++){joints[i*4+k]=list[k][0];weights[i*4+k]=list[k][1];}}
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.computeVertexNormals();
 if(part<14)paint(geometry,[7,8,11,13].includes(part)?palette.trim:palette.pocket);
 buckets[part===1?0:part>=14?2:1].push(geometry);
}
root.updateMatrixWorld(true);skeleton.update();
const meshes=[];for(const[slot,geos]of buckets.entries())if(geos.length){for(const g of geos)if(slot!==2&&!g.attributes.color)paint(g,palette.cloth);const g=mergeGeometries(geos,false);g.computeBoundingBox();g.computeBoundingSphere();const m=new T.SkinnedMesh(g,new T.MeshStandardMaterial({name:['parka_charcoal_cloth','parka_gray_trim','parka_silver_snaps'][slot],color:slot===2?palette.metal:'#ffffff',vertexColors:slot!==2,metalness:slot===2?.22:0,roughness:slot===2?.48:.92,side:T.DoubleSide}));m.name=`Apparel_${id}_${slot}`;body.parent.add(m);m.bind(skeleton,body.bindMatrix);meshes.push(m);}
const meta={id,triangles:meshes.reduce((s,m)=>s+m.geometry.index.count/3,0),drawCalls:meshes.length,revision:'charcoal-silver-reference',source:sourcePath,open:true,palette};root.userData.apparel=meta;
await saveGlb(root,`${out}/${id}-rig.glb`);
const only=new T.Group();for(const m of meshes){const g=m.geometry.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');const item=new T.Mesh(g,m.material);item.name=m.name;only.add(item);}await saveGlb(only,`${out}/${id}-only.glb`);
await fs.copyFile(`${out}/${id}-rig.glb`,`public/room3d/wardrobe/${id}-rig.glb`);
await fs.writeFile('output/clothing-rebuild-0920/hood-report.json',JSON.stringify(meta,null,2));console.log(meta);
