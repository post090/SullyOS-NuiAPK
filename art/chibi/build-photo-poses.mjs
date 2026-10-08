import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {BVHLoader} from 'three/examples/jsm/loaders/BVHLoader.js';
const approved=new Set(JSON.parse(fs.readFileSync('art/chibi/motion-sources/home-approved-selection.json')).entries.map(e=>e.id));
const sources=JSON.parse(fs.readFileSync('art/chibi/motion-sources/home-source-catalog.json')).filter(e=>e.kind==='pose'&&approved.has(e.id));
if(sources.some(e=>!e.files.every(f=>f.includes('/poses01/')||f.includes('/poses03/'))))throw Error('Only approved poses01/poses03 are permitted');
const dir='public/room3d/motions/photo';fs.mkdirSync(dir,{recursive:true});
const names={hips:'root',spine:'spine03',chest:'spine01',neck:'neck01',head:'head'},parents={hips:null,spine:'hips',chest:'spine',neck:'chest',head:'neck'};
for(const side of ['L','R']){
 for(const [joint,source,parent] of [['clavicle','clavicle','chest'],['upperArm','upperarm01','clavicle'],['forearm','lowerarm01','upperArm'],['hand','wrist','forearm'],['thigh','upperleg01','hips'],['shin','lowerleg01','thigh'],['foot','foot','shin'],['toe','toe1-1','foot']]){names[`${side}_${joint}`]=`${source}.${side}`;parents[`${side}_${joint}`]=['hips','chest'].includes(parent)?parent:`${side}_${parent}`;}
 for(const [i,finger] of ['thumb','index','middle','ring','pinky'].entries()){names[`${side}_${finger}`]=`finger${i+1}-1.${side}`;names[`${side}_${finger}_tip`]=`finger${i+1}-3.${side}`;parents[`${side}_${finger}`]=`${side}_hand`;parents[`${side}_${finger}_tip`]=`${side}_${finger}`;}
}
const entries=[];
for(const e of sources){
 const bytes=fs.readFileSync(e.files[0].slice(1));if(createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw Error(`Source changed: ${e.id}`);
 const {skeleton,clip}=new BVHLoader().parse(bytes.toString()),root=new T.Group();root.rotation.x=-Math.PI/2;root.add(skeleton.bones[0]);root.updateMatrixWorld(true);
 clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.position')||t.name===`${skeleton.bones[0].name}.position`||t.name===`.bones[${skeleton.bones[0].name}].position`);
 const nodes=Object.fromEntries(Object.entries(names).map(([key,name])=>[key,skeleton.bones.find(b=>b.name===name)]));
 for(const key of ['hips','head','L_thigh','L_shin','L_foot','R_hand'])if(!nodes[key])throw Error(`Missing ${key}: ${e.id}`);
 const rest=Object.fromEntries(Object.entries(nodes).filter(([,b])=>b).map(([n,b])=>[n,b.getWorldQuaternion(new T.Quaternion()).invert()]));
 const height=nodes.hips.getWorldPosition(new T.Vector3()).y,leg=nodes.L_thigh.getWorldPosition(new T.Vector3()).distanceTo(nodes.L_shin.getWorldPosition(new T.Vector3()))+nodes.L_shin.getWorldPosition(new T.Vector3()).distanceTo(nodes.L_foot.getWorldPosition(new T.Vector3()));
 const mixer=new T.AnimationMixer(root);mixer.clipAction(clip).play();mixer.setTime(0);root.updateMatrixWorld(true);
 const world=Object.fromEntries(Object.entries(rest).map(([n,r])=>[n,nodes[n].getWorldQuaternion(new T.Quaternion()).multiply(r)]));
 const tracks=Object.fromEntries(Object.keys(world).map(n=>{const q=(world[parents[n]]?.clone()??new T.Quaternion()).invert().multiply(world[n]).normalize().toArray();return [n,[...q,...q]];}));
 const position=nodes.hips.getWorldPosition(new T.Vector3()).multiplyScalar(1/leg).toArray();
 const points=Object.fromEntries(['L_hand','R_hand','L_upperArm','R_upperArm','hips','head'].map(n=>{const p=nodes[n].getWorldPosition(new T.Vector3()).multiplyScalar(1/leg).toArray();return [n,[...p,...p]];}));
 const data={version:1,id:e.id,duration:1,actors:[{duration:1,times:[0,1],tracks,positions:[...position,...position],points,hipHeight:height/leg}]};
 if(JSON.stringify(data).includes('null'))throw Error(`Invalid pose: ${e.id}`);
 fs.writeFileSync(`${dir}/${e.id}.json`,JSON.stringify(data));
 const thumbnail=e.thumbnail?`${e.id}.png`:undefined;if(thumbnail)fs.copyFileSync(e.thumbnail.slice(1),`${dir}/${thumbnail}`);
 entries.push({id:e.id,label:e.name,category:e.category.includes('坐')?'seated':'standing',duration:0,participants:1,file:`${e.id}.json`,thumbnail,source:e.source,sourceUrl:e.sourceUrl,sha256:e.sha256});mixer.stopAllAction();
}
fs.copyFileSync('art/chibi/motion-sources/PHOTO-POSE-CREDITS.md',`${dir}/CREDITS.md`);
fs.writeFileSync('apps/room3d/chibi/photoPoseCatalog.json',JSON.stringify(entries,null,2)+'\n');
console.log(`Published ${entries.length} approved static poses`);
