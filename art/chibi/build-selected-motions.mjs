// Freeze the reviewed sources, then retarget only those sources to the home rig.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {BVHLoader} from 'three/examples/jsm/loaders/BVHLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const selectionPath='art/chibi/motion-sources/home-approved-selection.json';
if(process.argv[2])fs.writeFileSync(selectionPath,JSON.stringify(JSON.parse(fs.readFileSync(process.argv[2])),null,2)+'\n');
const selection=JSON.parse(fs.readFileSync(selectionPath)).entries;
const catalogs=['output/social-motion-intake/catalog.json','output/social-motion-intake/poses/catalog.json'].map(p=>JSON.parse(fs.readFileSync(p)));
const output='public/room3d/motions/selected';fs.mkdirSync(output,{recursive:true});
const cmu={hips:'Hips',spine:'Spine',chest:'Spine1',neck:'Neck1',head:'Head'},vrm={hips:'hips',spine:'spine',chest:'chest',neck:'neck',head:'head'};
const parents={hips:null,spine:'hips',chest:'spine',neck:'chest',head:'neck'};
for(const [s,long] of [['L','Left'],['R','Right']])for(const [n,c,v,p] of [['clavicle','Shoulder','Shoulder','chest'],['upperArm','Arm','UpperArm','clavicle'],['forearm','ForeArm','LowerArm','upperArm'],['hand','Hand','Hand','forearm'],['thigh','UpLeg','UpperLeg','hips'],['shin','Leg','LowerLeg','thigh'],['foot','Foot','Foot','shin'],['toe','ToeBase','Toes','foot']]){cmu[s+'_'+n]=long+c;vrm[s+'_'+n]=long.toLowerCase()+v;parents[s+'_'+n]=['chest','hips'].includes(p)?p:s+'_'+p;}
const local=url=>decodeURIComponent(url.startsWith('/room3d/')?'public'+url:url.slice(1));
const categories={'cmu-22_07':'care','cmu-22_05':'care','cmu-22_04':'care','cmu-22_03':'care','cmu-22_09':'care','cmu-22_01':'care','cmu-22_13':'care','cmu-20_11':'greet','cmu-20_12':'greet','cmu-18_08':'talk','cmu-18_10':'conflict','cmu-22_08':'close','cmu-18_03':'close','cmu-18_05':'close','cmu-20_10':'play','cmu-20_13':'play','cmu-22_15':'play','cmu-22_17':'play'};
const category=e=>categories[e.id]??(/wave/.test(e.original)?'greet':/talk|listen|nod|shrug/.test(e.original)?'talk':/angry/.test(e.original)?'conflict':'self');
const entries=[];
const labels={idle:'自然站立','idle-talking-2':'聊天手势 1','idle-talking-3':'聊天手势 2','rb-idle-talking':'聊天手势 3','rb-listen':'认真倾听','rb-listen-3':'侧头倾听','reaction-startle':'吓了一跳',sad:'有点低落',nod:'点头','rb-nod-2':'点头回应',happy:'开心鼓掌','happy-2':'热情鼓掌','angry-2':'不太高兴','rb-shrug':'耸耸肩','airplane-02':'飞机手势','review-phone':'看手机','world-afk-texting':'低头发消息','rb-think':'想一想','rb-wave':'招手','rb-wave-2':'挥手回应'};
for(const selected of selection){
 const e=catalogs.flatMap(c=>c.entries).find(e=>e.id===selected.id);if(!e||JSON.stringify(e.files)!==JSON.stringify(selected.files))throw Error('Selection/source mismatch: '+selected.id);
 if(e.kind==='pose')continue;
 const actors=[],hashes=[];
 for(const url of e.files){
  const bytes=fs.readFileSync(local(url));hashes.push(createHash('sha256').update(bytes).digest('hex'));
  let root,clip,nodes,start=0;
  if(e.format==='bvh'){
   const p=new BVHLoader().parse(bytes.toString());root=p.skeleton.bones[0];clip=p.clip;nodes=Object.fromEntries(Object.entries(cmu).map(([n,s])=>[n,p.skeleton.bones.find(b=>b.name===s)]));start=1/120;
  }else{
   const p=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');root=p.scene;clip=p.animations[0];const human=p.parser.json.extensions.VRMC_vrm_animation.humanoid.humanBones;
   nodes=Object.fromEntries(await Promise.all(Object.entries(vrm).map(async([n,s])=>[n,human[s]?await p.parser.getDependency('node',human[s].node):undefined])));
  }
  if(Object.entries(nodes).some(([n,b])=>!b&&!n.endsWith('_toe')))throw Error('Missing source bone: '+url);
  root.updateMatrixWorld(true);
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;
  if(start){action.play();mixer.setTime(0);root.updateMatrixWorld(true);}
  const rest=Object.fromEntries(Object.entries(nodes).filter(([,b])=>b).map(([n,b])=>[n,b.getWorldQuaternion(new T.Quaternion()).invert()]));
  const hipHeight=nodes.hips.getWorldPosition(new T.Vector3()).y;
  const leg=nodes.L_thigh.getWorldPosition(new T.Vector3()).distanceTo(nodes.L_shin.getWorldPosition(new T.Vector3()))+nodes.L_shin.getWorldPosition(new T.Vector3()).distanceTo(nodes.L_foot.getWorldPosition(new T.Vector3()));
  // Normalized units use source leg length, not head height (our heads are stylized).
  const scale=1/leg;action.play();
  const duration=clip.duration-start,frames=Math.ceil(duration*30),times=[],tracks=Object.fromEntries(Object.keys(rest).map(n=>[n,[]])),positions=[],points={};
  for(const n of ['L_hand','R_hand','L_upperArm','R_upperArm','hips','head'])points[n]=[];
  for(let f=0;f<=frames;f++){
   const t=duration*f/frames;times.push(+t.toFixed(6));mixer.setTime(start+t);root.updateMatrixWorld(true);
   const world=Object.fromEntries(Object.entries(rest).map(([n,r])=>[n,nodes[n].getWorldQuaternion(new T.Quaternion()).multiply(r)]));
   for(const n of Object.keys(tracks)){const q=(world[parents[n]]?.clone()??new T.Quaternion()).invert().multiply(world[n]).normalize(),v=tracks[n];if(v.length&&q.dot(new T.Quaternion().fromArray(v,v.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);v.push(...q.toArray().map(v=>+v.toFixed(5)));}
   positions.push(...nodes.hips.getWorldPosition(new T.Vector3()).multiplyScalar(scale).toArray().map(v=>+v.toFixed(5)));
   for(const n of Object.keys(points))points[n].push(...nodes[n].getWorldPosition(new T.Vector3()).multiplyScalar(scale).toArray().map(v=>+v.toFixed(5)));
  }
  actors.push({duration,times,tracks,positions,points,hipHeight:hipHeight*scale,sourceLeg:leg});mixer.uncacheRoot(root);
 }
 // Both roles retain one capture coordinate system, even with unequal source heights.
 for(const a of actors){const ratio=a.sourceLeg/actors[0].sourceLeg;a.positions=a.positions.map(v=>+(v*ratio).toFixed(5));for(const n of Object.keys(a.points))a.points[n]=a.points[n].map(v=>+(v*ratio).toFixed(5));a.hipHeight*=ratio;}
 const duration=Math.min(...actors.map(a=>a.duration));
 const entry={id:e.id,label:labels[e.original]??e.name.replace(/^0[123] /,''),category:category(e),source:e.source,sourceUrl:e.sourceUrl,duration,participants:actors.length,file:`${e.id}.json`,hashes};
 fs.writeFileSync(`${output}/${entry.file}`,JSON.stringify({version:1,id:e.id,duration,actors})+'\n');entries.push(entry);
}
fs.copyFileSync('output/social-motion-intake/Hanami/vrma/NOTICE.md',`${output}/Hanami-NOTICE.md`);
fs.copyFileSync('output/social-motion-intake/CMU/README-license.txt',`${output}/CMU-LICENSE.txt`);
fs.writeFileSync(`${output}/CREDITS.md`,'# Selected home motions\n\nCMU motion capture: Carnegie Mellon University, converted by cgspeed. See CMU-LICENSE.txt.\n\nHanami conversions: Overte / High Fidelity / Vircadia (Apache-2.0), Microsoft Rocketbox (MIT); see the complete Hanami-NOTICE.md.\n\nSullyOS modifications: 30 fps resampling, rest-space retargeting, paired root trajectories and runtime contact adjustment. Source URLs and SHA256 are in manifest.json.\n');
// Keep project-authored interactions when rebuilding the imported motion selection.
entries.unshift(...JSON.parse(fs.readFileSync('apps/room3d/chibi/selectedMotionCatalog.json','utf8')).filter(e=>['home-hug','home-princess-carry','home-princess-carried'].includes(e.id)));
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify({version:1,entries},null,2)+'\n');
fs.writeFileSync('apps/room3d/chibi/selectedMotionCatalog.json',JSON.stringify(entries,null,2)+'\n');
console.log(JSON.stringify({motions:entries.length,poses:selection.length-entries.length,actors:entries.reduce((n,e)=>n+e.participants,0)}));
