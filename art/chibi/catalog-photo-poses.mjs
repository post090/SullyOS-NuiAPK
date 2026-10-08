// MakeHuman CC0 source poses, local audition only. BVH rotations and skeleton
// are kept; joint translations follow MakeHuman's onlyroot convention.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import * as T from 'three';import {BVHLoader} from 'three/examples/jsm/loaders/BVHLoader.js';
const dir='output/social-motion-intake/poses',entries=[],audit=[];
const names={anrico_sitting02:'坐姿 · 回身',anrico_sitting03:'坐姿 · 03',anrico_sitting04:'坐姿 · 04',anrico_sitting07:'坐姿 · 07',anrico_sitting10:'坐姿 · 10',lotus:'盘腿坐',sittingdefault:'端坐',sittingfloor2:'席地坐',sittingfloorstretch2:'坐地伸腿',sittinglegscrossed:'交叠腿坐',sittingnatural:'自然坐姿',what_have_i_done:'懊恼坐姿',sit_01a:'坐姿 · 01A',swinging_01:'秋千坐姿',sitting_in_armchair_holding_wine_glass:'扶手椅持杯', 'sitting-pose':'坐姿 · Sweetan',sit_on_ground_01:'坐地 · Wolgade',sitting_floor_3:'坐地 · Xhado',standing10:'站姿 · 10',standing11:'站姿 · 11',david:'大卫站姿',curious:'好奇探身',salute:'敬礼',standingatattention:'立正',standingatease:'稍息',standingdefault:'基础站姿',standingmodest:'含蓄站姿',standingmodestembarrassed:'害羞站姿',standingnatural:'自然站姿',arms_akimbo:'双手叉腰',epic_haute_couture_1:'时装摆姿 · 01',epic_haute_couture_2:'时装摆姿 · 02',super_him_standing_pose_1:'英气站姿 · 01',super_him_standing_pose_2:'英气站姿 · 02',peace_and_love:'比耶 / Peace',standing_posing:'站立摆姿',leaning_on_counter_hands_folded:'倚台交叠双手',standing_holding_wine_glass:'站立持杯',hand_on_shoulder_01:'手搭肩 · 01',hand_on_shoulder_02:'手搭肩 · 02',hand_on_shoulder_03:'手搭肩 · 03',pd_fashion01:'模特站姿 · 01',pd_fashion02:'模特站姿 · 02',pd_fashion_handbag:'手袋摆姿',train_departure:'出发挥手',sohh_embarrassed:'害羞 · Sohh',standing1:'站姿 · Sohh 01',standing2:'站姿 · Sohh 02',...Object.fromEntries(Array.from({length:6},(_,i)=>[`posing${i+1}`,`摆拍 · Sohh 0${i+1}`]))};
for(const pack of ['poses03','poses01']){
 const base=`${dir}/${pack}/poses`,page=fs.readFileSync(`${dir}/${pack}-source.html`,'utf8');
 for(const original of fs.readdirSync(base).sort()){
  const file=`${base}/${original}/${original}.bvh`;if(!fs.existsSync(file))continue;
  const bytes=fs.readFileSync(file),{skeleton,clip}=new BVHLoader().parse(bytes.toString()),root=new T.Group();root.add(skeleton.bones[0]);
  const metaPath=file.replace(/\.bvh$/,'.meta'),meta=fs.existsSync(metaPath)?fs.readFileSync(metaPath,'utf8'):'';
  const author=meta.match(/^author\s+(.+)/m)?.[1]??original.split('_')[0];
  // Reject unchecked sources rather than assigning CC0 just from a folder name.
  const row=[...page.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]).find(row=>row.includes(original));if(!row?.includes('CC0'))throw Error(`Missing source license: ${original}`);
  const sourceUp='Z';root.rotation.x=-Math.PI/2;
  // Some exporters repeat rest offsets in every joint's position channels.
  // The official MakeHuman importer ignores these non-root translations.
  clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.position')||t.name===`${skeleton.bones[0].name}.position`||t.name===`.bones[${skeleton.bones[0].name}].position`);
  for(const track of clip.tracks)if(!track.validate()||![...track.values].every(Number.isFinite))throw Error(`Invalid track: ${file}`);
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.play();mixer.setTime(0);root.updateMatrixWorld(true);
  const body=/^(root|spine\d+|neck\d+|head|clavicle\.[LR]|shoulder01\.[LR]|upperarm01\.[LR]|lowerarm01\.[LR]|wrist\.[LR]|pelvis\.[LR]|upperleg01\.[LR]|lowerleg01\.[LR]|foot\.[LR]|toe1-1\.[LR]|finger[1-5]-[1-3]\.[LR])$/;
  // Include terminal finger tips so the last knuckle's curl is visible.
  for(const bone of skeleton.bones)if(bone.name==='ENDSITE'&&/^finger/.test(bone.parent?.name??''))bone.name=bone.parent.name+'-tip';
  const nodes=skeleton.bones.filter(b=>body.test(b.name)||/^finger.*-tip$/.test(b.name));if(nodes.length<20)throw Error(`Incomplete body: ${original}`);
  const nodeSet=new Set(nodes),parents=nodes.map(b=>{let p=b.parent;while(p&&!nodeSet.has(p))p=p.parent;return nodes.indexOf(p);});
  const points=nodes.map(b=>b.getWorldPosition(new T.Vector3())),bounds=new T.Box3().setFromPoints(points),center=bounds.getCenter(new T.Vector3());
  // Preview normalization only; source BVH and its author proportions untouched.
  const scale=1.8/bounds.getSize(new T.Vector3()).y;const values=points.flatMap(p=>[+(scale*(p.x-center.x)).toFixed(6),+(scale*(p.y-bounds.min.y)).toFixed(6),+(scale*(p.z-center.z)).toFixed(6)]);
  if(!values.every(Number.isFinite))throw Error(`Non-finite pose: ${original}`);
  const cache=file.replace(/\.bvh$/,'.preview.json');fs.writeFileSync(cache,JSON.stringify({duration:1,names:nodes.map(b=>b.name),parents,frames:[values]}));
  const thumb=file.replace(/\.bvh$/,'.thumb'),thumbnail=file.replace(/\.bvh$/,'.png');if(fs.existsSync(thumb))fs.copyFileSync(thumb,thumbnail);
  const name=names[original]??names[original.slice(original.indexOf('_')+1)]??original;
  const id=`pose-mh-${original}`,entry={id,name,original,kind:'pose',category:pack==='poses03'?'合照 · 站姿':'合照 · 坐姿',format:'pose-points',files:['/'+file],preview:'/'+cache,thumbnail:fs.existsSync(thumb)?'/'+thumbnail:undefined,duration:0,source:`MakeHuman · ${author}`,sourceUrl:`https://static.makehumancommunity.org/assets/assetpacks/${pack}.html`,license:'/art/chibi/motion-sources/PHOTO-POSE-CREDITS.md',description:'静态源姿势 · 可旋转查看；椅子、手袋、杯子等道具未包含。尚未适配家园素体。',sha256:createHash('sha256').update(bytes).digest('hex')};
  entries.push(entry);audit.push({id,sourceUp,sourceFrames:clip.tracks[0].times.length,sourceDuration:clip.duration,displayFrame:0,bones:nodes.length,author,sha256:entry.sha256});mixer.stopAllAction();mixer.uncacheRoot(root);
 }
}
// Put easy-to-recognize photo poses first, keeping IDs independent of ordering.
const priority=['gpedroso_peace_and_love','drednicolson_arms_akimbo','callharvey3d_standingnatural','callharvey3d_standingmodestembarrassed'];entries.sort((a,b)=>{const score=x=>priority.includes(x.original)?priority.indexOf(x.original):-1;return (score(a)<0?999:score(a))-(score(b)<0?999:score(b));});
const pending=fs.existsSync(`${dir}/download-manifest.json`)?JSON.parse(fs.readFileSync(`${dir}/download-manifest.json`)).filter(x=>x.downloaded===false):[];
fs.writeFileSync(`${dir}/catalog.json`,JSON.stringify({entries,pending},null,2));fs.writeFileSync(`${dir}/validation.json`,JSON.stringify(audit,null,2));console.log(JSON.stringify({poses:entries.length,standing:entries.filter(e=>e.category==='合照 · 站姿').length,sitting:entries.filter(e=>e.category==='合照 · 坐姿').length,pending:pending.length}));

await import('./finalize-motion-selection.mjs');
