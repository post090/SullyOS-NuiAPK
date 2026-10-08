import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {BVHLoader} from 'three/examples/jsm/loaders/BVHLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';


type Entry={id:string;name:string;original:string;category:string;format:'bvh'|'vrma'|'pose-points';files:string[];duration:number;source:string;sourceUrl:string;license:string;description?:string;approved?:boolean;preview?:string;kind?:'pose';thumbnail?:string};
type Actor={root:T.Object3D;clip:T.AnimationClip;mixer:T.AnimationMixer;action:T.AnimationAction;visual:T.Group;joints:{bone:T.Object3D;mesh:T.Mesh}[];limbs:{from:T.Object3D;to:T.Object3D;mesh:T.Mesh}[];radius:number;samplePoints?:(t:number)=>void};
type PointCapture={duration:number;names:string[];parents:number[];frames:number[][]};
const el=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
const host=el('stage'),status=el('status'),seek=el<HTMLInputElement>('seek'),play=el<HTMLButtonElement>('play'),restart=el<HTMLButtonElement>('restart'),save=el<HTMLButtonElement>('save'),search=el<HTMLInputElement>('search'),category=el<HTMLSelectElement>('category'),collection=el<HTMLSelectElement>('collection'),speed=el<HTMLSelectElement>('speed'),loop=el<HTMLInputElement>('loop');
const storageKey='sully.motion-library.saved.v1';
let saved=new Set<string>();try{const data=JSON.parse(localStorage.getItem(storageKey)??'[]');if(Array.isArray(data))saved=new Set(data.filter(x=>typeof x==='string'));}catch{/* Invalid local preference is safe to ignore. */}
const scene=new T.Scene();scene.background=new T.Color('#e8eee0');scene.add(new T.HemisphereLight('#ffffff','#8da77d',2.4));const sun=new T.DirectionalLight('#ffffff',2);sun.position.set(3,6,4);scene.add(sun);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const camera=new T.PerspectiveCamera(38,1,.01,500),controls=new OrbitControls(camera,renderer.domElement);controls.minDistance=.3;controls.maxDistance=120;controls.maxPolarAngle=Math.PI*.49;
const grid=new T.GridHelper(16,32,'#a8be97','#d1dec5');grid.position.y=-.015;scene.add(grid);
const group=new T.Group();scene.add(group);
const cylinder=new T.CylinderGeometry(1,1,1,10),sphere=new T.SphereGeometry(1,12,10),materials=[new T.MeshStandardMaterial({color:'#528c40',roughness:1}),new T.MeshStandardMaterial({color:'#738380',roughness:1})];
const up=new T.Vector3(0,1,0),p=new T.Vector3(),q=new T.Vector3(),delta=new T.Vector3();
let entries:Entry[]=[],current:Entry|undefined,actors:Actor[]=[],duration=0,time=0,playing=false,generation=0,abort:AbortController|undefined,ready=false;
type LibraryView='poses'|'motions';let view:LibraryView='motions';
const center=new T.Vector3(),size=new T.Vector3();

function makeActor(root:T.Object3D,clip:T.AnimationClip,nodes:T.Object3D[],index:number):Actor{
 const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();root.updateMatrixWorld(true);
 const nodeSet=new Set(nodes),bounds=new T.Box3();for(const node of nodes)bounds.expandByPoint(node.getWorldPosition(p));const radius=Math.max(bounds.getSize(q).y*.014,.003),visual=new T.Group(),joints:Actor['joints']=[],limbs:Actor['limbs']=[];
 for(const bone of nodes){const mesh=new T.Mesh(sphere,materials[index]);const head=/head|^頭$/i.test(bone.name);mesh.scale.setScalar(radius*(head?2.8:1.25));visual.add(mesh);joints.push({bone,mesh});let parent=bone.parent;while(parent&&!nodeSet.has(parent))parent=parent.parent;if(parent){const mesh=new T.Mesh(cylinder,materials[index]);visual.add(mesh);limbs.push({from:parent,to:bone,mesh});}}
 group.add(visual);return {root,clip,mixer,action,visual,joints,limbs,radius};
}
function pointActor(data:PointCapture,index:number):Actor{
 const root=new T.Group(),nodes=data.names.map(name=>{const b=new T.Bone();b.name=name;return b;});
 nodes.forEach((b,i)=>(data.parents[i]<0?root:nodes[data.parents[i]]).add(b));
 const samplePoints=(t:number)=>{const values=data.frames[Math.min(data.frames.length-1,Math.max(0,Math.floor(t*30+1e-6)))];nodes.forEach((b,i)=>{b.position.fromArray(values,i*3);if(data.parents[i]>=0)b.position.sub(p.fromArray(values,data.parents[i]*3));});root.updateMatrixWorld(true);};
 samplePoints(0);const actor=makeActor(root,new T.AnimationClip('Static photo pose',data.duration,[]),nodes,index);actor.samplePoints=samplePoints;return actor;
}
function sample(t:number){for(const actor of actors){if(actor.samplePoints)actor.samplePoints(t);else{actor.action.paused=false;actor.mixer.setTime(Math.min(actor.clip.duration-.00001,t+(current?.format==='bvh'?1/120:0)));}actor.root.updateMatrixWorld(true);for(const j of actor.joints)j.bone.getWorldPosition(j.mesh.position);for(const limb of actor.limbs){limb.from.getWorldPosition(p);limb.to.getWorldPosition(q);limb.mesh.position.copy(p).lerp(q,.5);delta.subVectors(q,p);const radius=actor.radius*(current?.kind==='pose'&&/^finger/.test(limb.to.name)?.28:1);limb.mesh.scale.set(radius,delta.length(),radius);if(delta.lengthSq()>1e-12)limb.mesh.quaternion.setFromUnitVectors(up,delta.normalize());}}}
function render(){sample(time);renderer.render(scene,camera);seek.value=String(time);el('time').textContent=current?.kind==='pose'?'静态姿势':`${time.toFixed(1)} / ${duration.toFixed(1)} s`;play.textContent=playing?'暂停':'播放';}
function fit(){controls.target.set(0,size.y*.5,0);const d=Math.max(size.x,size.z,size.y,2)*1.65*Math.max(1,1/camera.aspect);camera.position.set(d*.55,size.y*.6+d*.3,d);controls.update();renderer.render(scene,camera);}
function focusCurrent(){if(!ready)return;sample(time);group.updateMatrixWorld(true);const bounds=new T.Box3();for(const actor of actors)for(const joint of actor.joints)bounds.expandByPoint(joint.mesh.getWorldPosition(p));const target=bounds.getCenter(new T.Vector3()),extent=bounds.getSize(new T.Vector3()),d=Math.max(extent.x,extent.y,extent.z,1)*1.65*Math.max(1,1/camera.aspect);controls.target.copy(target);camera.position.copy(target).add(new T.Vector3(d*.55,d*.2,d));controls.update();renderer.render(scene,camera);}
function clear(){for(const actor of actors){actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.root);actor.visual.removeFromParent();}actors=[];ready=false;}
function filtered(){const query=search.value.trim().toLowerCase();return entries.filter(e=>(view==='poses'?e.kind==='pose':e.kind!=='pose')&&(!category.value||e.category===category.value)&&(!collection.value||(collection.value==='approved'?e.approved:saved.has(e.id)||e.approved))&&(!query||`${e.name} ${e.original} ${e.source} ${e.description??''}`.toLowerCase().includes(query)));}
function switchView(next:LibraryView){view=next;document.body.classList.toggle('pose-view',view==='poses');for(const name of ['poses','motions'])el(`view-${name}`).setAttribute('aria-pressed',String(view===name));category.replaceChildren(new Option('全部分类',''));for(const value of [...new Set(entries.filter(e=>view==='poses'?e.kind==='pose':e.kind!=='pose').map(e=>e.category))])category.add(new Option(value,value));search.value='';search.placeholder=view==='poses'?'比耶、叉腰、坐姿…':'牵手、交谈、wave…';collection.value='';el('pose-intro').hidden=view!=='poses';list();}
function persistSelection(entry:Entry,selected:boolean){if(entry.approved)return;if(selected)saved.add(entry.id);else saved.delete(entry.id);try{localStorage.setItem(storageKey,JSON.stringify([...saved]));}catch{status.textContent='浏览器无法保存收藏，请用“导出收藏”保留。';}showSave();list();}
function showSave(){save.textContent=current?.approved?'✓ 已选原片':current&&saved.has(current.id)?'✓ 已收藏':'＋ 收藏';save.disabled=!ready||!!current?.approved;save.setAttribute('aria-pressed',String(!!current&&(current.approved||saved.has(current.id))));}
function list(){const visible=filtered();el('count').textContent=view==='poses'?`${visible.length} 个姿势 · 已选 ${entries.filter(e=>e.kind==='pose'&&(e.approved||saved.has(e.id))).length}`:`${visible.length} 项 / ${entries.filter(e=>e.kind!=='pose').length} 项`;const fragment=document.createDocumentFragment();for(const e of visible){const b=document.createElement('button'),strong=document.createElement('strong'),small=document.createElement('small');b.dataset.id=e.id;b.setAttribute('aria-pressed',String(e.id===current?.id));strong.textContent=`${e.approved?'✓ ':saved.has(e.id)?'★ ':''}${e.name}`;small.textContent=e.kind==='pose'?e.source:`${e.files.length===2?'双人 · ':''}${e.duration.toFixed(1)}s · ${e.source}`;if(e.thumbnail){const img=document.createElement('img');img.src=e.thumbnail;img.alt=e.name;img.loading='lazy';b.append(img);}b.append(strong,small);b.onclick=()=>{void load(e.id);if(e.kind==='pose'&&matchMedia('(max-width:700px)').matches)host.scrollIntoView({behavior:'smooth',block:'start'});};if(e.kind==='pose'){const card=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input');card.className='pose-card';check.type='checkbox';check.checked=!!e.approved||saved.has(e.id);check.disabled=!!e.approved;check.setAttribute('aria-label',`选择 ${e.name}`);check.onchange=()=>persistSelection(e,check.checked);label.append(check,document.createTextNode(e.approved?'已确认保留':'加入收藏'));card.append(b,label);fragment.append(card);}else fragment.append(b);}if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent='没有匹配的动作，试试其他关键词。';fragment.append(p);}el('clips').replaceChildren(fragment);}

async function load(id:string){
 const entry=entries.find(e=>e.id===id);if(!entry)return;if((entry.kind==='pose')!==(view==='poses'))switchView(entry.kind==='pose'?'poses':'motions');current=entry;const token=++generation;abort?.abort();const controller=new AbortController();abort=controller;clear();time=duration=0;playing=false;play.disabled=restart.disabled=seek.disabled=true;showSave();list();el('title').textContent=entry.name;el('original').textContent=entry.original;el('category-label').textContent=entry.approved?'已选原片':entry.category;status.textContent='载入本地动作…';el('pose-controls').hidden=entry.kind!=='pose';
 (el<HTMLAnchorElement>('source')).href=entry.sourceUrl;el<HTMLAnchorElement>('license').href=entry.license;el<HTMLAnchorElement>('local').href=entry.files[0];
 try{
  if(entry.format==='pose-points'){
   const response=await fetch(entry.preview!,{signal:controller.signal});if(!response.ok)throw Error('本地姿势缓存缺失，请运行 pnpm node art/chibi/catalog-photo-poses.mjs');const data=await response.json();if(token!==generation)return;actors=[pointActor(data,0)];
   // Thin finger joints remain readable without overwhelming the hands.
   for(const joint of actors[0].joints)if(/^finger/.test(joint.bone.name))joint.mesh.scale.multiplyScalar(.28);
  }else{
  const bytes=await Promise.all(entry.files.map(async url=>{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.arrayBuffer();}));
  const parsed=await Promise.all(bytes.map(async buffer=>{if(entry.format==='bvh'){const {skeleton,clip}=new BVHLoader().parse(new TextDecoder().decode(buffer));return {root:skeleton.bones[0],clip,nodes:skeleton.bones.filter(b=>b.name!=='ENDSITE')};}const gltf=await new GLTFLoader().parseAsync(buffer,'');const human=gltf.parser.json.extensions.VRMC_vrm_animation.humanoid.humanBones;const nodes=await Promise.all(Object.values(human).map((v:any)=>gltf.parser.getDependency('node',v.node)));return {root:gltf.scene,clip:gltf.animations[0],nodes};}));
  if(token!==generation)return;
  actors=parsed.map((a,i)=>makeActor(a.root,a.clip,a.nodes,i));
  }
  duration=entry.kind==='pose'?0:Math.max(0,Math.min(...actors.map(a=>a.clip.duration))-(entry.format==='bvh'?1/120:0));seek.max=String(duration||1);
  // Fit the complete capture as one group; never normalize actors independently.
  group.position.set(0,0,0);group.scale.setScalar(1);const bounds=new T.Box3();for(let i=0;i<=32;i++){sample(duration*i/32);for(const a of actors)for(const j of a.joints)bounds.expandByPoint(j.mesh.position);}
  const scale=entry.format==='bvh'?.055:1;group.scale.setScalar(scale);bounds.getCenter(center).multiplyScalar(scale);bounds.getSize(size).multiplyScalar(scale);group.position.set(-center.x,-bounds.min.y*scale,-center.z);fit();ready=true;play.disabled=restart.disabled=seek.disabled=entry.kind==='pose';showSave();status.textContent=(entry.description??`${entry.source} · ${entry.original}`)+' · 已载入';if(entry.kind==='pose')poseCamera('front');render();
 }catch(error){if(token===generation&&!controller.signal.aborted){clear();status.textContent=`载入失败：${error}`;console.error(error);}}
}
play.onclick=()=>{if(!ready||current?.kind==='pose')return;if(time>=duration)time=0;playing=!playing;render();};restart.onclick=()=>{if(!ready||current?.kind==='pose')return;time=0;playing=true;render();};seek.oninput=()=>{time=+seek.value;playing=false;render();};el('fit').onclick=fit;
el('focus').onclick=focusCurrent;

for(const input of [search,category,collection])input.addEventListener('input',list);
save.onclick=()=>{if(current)persistSelection(current,!saved.has(current.id));};
function poseCamera(direction:'front'|'side'|'back'){if(!ready)return;controls.target.set(0,size.y*.5,0);const depth=direction==='side'?size.x:size.z,d=Math.max(size.x,size.y,size.z,1.8)*1.9*Math.max(1,1/camera.aspect)+depth*.5;camera.position.set(direction==='side'?d:0,size.y*.5,direction==='front'?d:direction==='back'?-d:0);controls.update();renderer.render(scene,camera);}
for(const direction of ['front','side','back'] as const)el(`pose-${direction}`).onclick=()=>poseCamera(direction);
for(const [button,step] of [['pose-prev',-1],['pose-next',1]] as const)el(button).onclick=()=>{const choices=filtered();if(!choices.length)return;const at=choices.findIndex(e=>e.id===current?.id);void load(choices[(at+step+choices.length)%choices.length].id);};
for(const name of ['poses','motions'] as const)el(`view-${name}`).onclick=()=>{switchView(name);const first=filtered()[0];if(first)void load(first.id);};
el('export').onclick=()=>{const chosen=entries.filter(e=>e.approved||saved.has(e.id)).map(e=>({id:e.id,name:e.name,original:e.original,files:e.files,sourceUrl:e.sourceUrl,approvedSource:!!e.approved}));const blob=new Blob([JSON.stringify({kind:'local-motion-selection',entries:chosen},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sully-motion-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(()=>{const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}).observe(host);
function advance(seconds:number){if(!ready||current?.kind==='pose')return;time+=seconds;if(time>=duration){if(loop.checked&&duration>0)time%=duration;else{time=duration;playing=false;}}render();}
let last=performance.now();function frame(now:number){const dt=Math.min((now-last)/1000,.1);last=now;if(playing)advance(dt*+speed.value);else renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
const w=window as any;w.advanceTime=(ms:number)=>{if(playing)advance(ms/1000*+speed.value);else render();};w.render_game_to_text=()=>JSON.stringify({id:current?.id,original:current?.original,format:current?.format,view,staticPose:current?.kind==='pose',ready,time,duration,playing,actors:actors.length,visible:filtered().length,total:entries.length,saved:entries.filter(e=>e.approved||saved.has(e.id)).length,selectedPoses:entries.filter(e=>e.kind==='pose'&&(e.approved||saved.has(e.id))).length,retargeted:false,coordinates:'Y up; source skeleton preview; static poses normalized for viewing'});w.__motionLibrary={load,seek(t:number){time=T.MathUtils.clamp(t,0,duration);playing=false;render();},get entries(){return entries;},get actors(){return actors;}};
async function init(){try{
 const [r,poseResponse]=await Promise.all([fetch('/output/social-motion-intake/catalog.json'),fetch('/output/social-motion-intake/poses/catalog.json')]);if(!r.ok)throw Error('未找到本地素材目录，先运行下载和目录脚本');const catalog=await r.json(),poses=poseResponse.ok?await poseResponse.json():{entries:[]};entries=[...catalog.entries,...poses.entries];
 el('summary').textContent=`${poses.entries.length} 个合照姿势 · ${catalog.entries.length} 个确认动作 · 未选候选已撤下`;
 const params=new URLSearchParams(location.search),requested=params.get('motion');switchView(params.get('view')==='poses'||entries.find(e=>e.id===requested)?.kind==='pose'?'poses':'motions');
 if(view==='poses'&&!poses.entries.length){status.textContent='本地姿势目录缺失，请运行 pnpm node art/chibi/catalog-photo-poses.mjs';return;}await load(entries.some(e=>e.id===requested)?requested!:filtered()[0].id);
 }catch(error){status.textContent=String(error);}}
void init().then(()=>{const count=entries.filter(e=>e.approved).length;const option=collection.querySelector('option[value="approved"]');if(option)option.textContent=`已确认（${count}）`;});
