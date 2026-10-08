// User-supplied Meshy export. Keep exact source identity; no source meshes shipped.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const manifest=JSON.parse(fs.readFileSync('art/chibi/motion-sources/meshy-user-pack-20260930.json','utf8'));
const selected={sleep:['01','sleep'],Sit_Cross_Legged:['04','sit-alternate'],Idle_15:['06','dress-once'],Stand_and_Drink:['07','coffee-drink'],Wave_for_Help_3:['08','wave-alternate-1'],Wave_for_Help_4:['09','wave-alternate-2'],Walking:['10','walk'],circle_crunch:['13','yoga']};
const mapping={hips:'Hips',spine:'Spine',chest:'Spine2',neck:'Neck',head:'Head'},parents={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck'};
for(const [side,prefix] of [['Left','L'],['Right','R']])for(const [target,source,parent] of [['clavicle','Shoulder','chest'],['upperArm','Arm','clavicle'],['forearm','ForeArm','upperArm'],['hand','Hand','forearm'],['thigh','UpLeg','hips'],['shin','Leg','thigh'],['foot','Foot','shin'],['toe','ToeBase','foot']]){
 mapping[`${prefix}_${target}`]=side+source;parents[`${prefix}_${target}`]=['chest','hips'].includes(parent)?parent:`${prefix}_${parent}`;
}
const output={};
for(const entry of manifest.entries.filter(e=>selected[e.id])){
 const bytes=fs.readFileSync(path.join(process.argv[2]??'output/meshy-motion-audition/assets',entry.file));
 if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Changed source: ${entry.file}`);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 let skin;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skin??=o;});
 if(!skin)throw Error(`No skin: ${entry.id}`);
 const nodes={},rest={},restPositions={};
 for(const [name,source] of Object.entries(mapping)){
  const index=skin.skeleton.bones.findIndex(b=>b.name===`mixamorig${source}`);
  if(index<0)throw Error(`Missing ${source}`);
  nodes[name]=skin.skeleton.bones[index];
  // Exported node transforms may already be posed. The inverse bind matrices
  // are the actual T pose, and include the source bone-axis correction.
  const matrix=skin.skeleton.boneInverses[index].clone().invert(),p=new T.Vector3(),q=new T.Quaternion();
  matrix.decompose(p,q,new T.Vector3());rest[name]=q.invert();restPositions[name]=p;
 }
 const source=gltf.animations[0],mixer=new T.AnimationMixer(gltf.scene),action=mixer.clipAction(source);
 action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const frames=Math.ceil(source.duration*30),times=[],root=[],tracks=Object.fromEntries(Object.keys(nodes).map(n=>[n,[]]));
 for(let i=0;i<=frames;i++){
  const time=i/frames*source.duration;times.push(+time.toFixed(6));mixer.setTime(time);gltf.scene.updateMatrixWorld(true);
  const world=Object.fromEntries(Object.entries(nodes).map(([name,b])=>[name,b.getWorldQuaternion(new T.Quaternion()).multiply(rest[name]).normalize()]));
  for(const name of Object.keys(nodes)){
   const q=(world[parents[name]]?.clone()??new T.Quaternion()).invert().multiply(world[name]).normalize(),values=tracks[name];
   if(values.length&&q.dot(new T.Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);
   values.push(...q.toArray().map(n=>+n.toFixed(6)));
  }
  root.push(...nodes.hips.getWorldPosition(new T.Vector3()).sub(restPositions.hips).divideScalar(restPositions.hips.y).toArray().map(n=>+n.toFixed(6)));
 }
 const [number,purpose]=selected[entry.id];
 output[purpose]={number,sourceName:entry.id,sourceFile:entry.file,sourceSha256:entry.sha256,duration:source.duration,times,tracks,root};
 console.log(number,purpose,source.duration);
}
fs.writeFileSync(process.argv[3]??'apps/room3d/chibi/meshyMotions.json',JSON.stringify(output)+'\n');
