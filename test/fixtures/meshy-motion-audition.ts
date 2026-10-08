import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './meshy-motion-audition.css';
import {meshySelections,meshyMotions} from '../../apps/room3d/chibi/meshyMotions';

// User-provided commercial exports stay in ignored local output, never public/.
const base='/output/meshy-motion-audition/';
type Entry={id:string;label:string;file:string;sha256:string;bones:number;clips:{name:string;duration:number}[];bounds:{min:number[];max:number[]}};
document.querySelector('#app')!.innerHTML=`
 <header><div><p class="eyebrow">二号素体 / 动作试映</p><h1>看看这次带回来的动作</h1><p>拖动画面旋转视角，滚轮缩放。先看原动作，再挑喜欢的。</p></div><a href="/test/fixtures/room3d-body-comparison.html?room=bedroom">回到卧室对照 ↗</a></header>
 <div class="workspace"><aside><h2>你的 14 段动作</h2><div id="list"></div><p class="source">来源：用户提供的 Meshy 导出包<br>原始 28 骨架 · 保留动作位移<br>已选 01 / 04 / 06 / 07 / 08 / 09 / 10 / 13<br>此页保留原动作供对照</p></aside>
 <section class="stage"><div id="viewport"></div><div class="caption"><span id="label">正在读取动作包…</span><span id="status" role="status"></span></div>
 <div class="controls"><div class="buttons"><button id="play" disabled>暂停</button><button id="replay" disabled>从头播放</button><button id="fit" disabled>完整取景</button><button id="front">正面</button><button id="side">侧面</button><label>速度 <select id="speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label><label><input id="loop" type="checkbox">循环</label><label><input id="skeleton" type="checkbox">骨架</label></div>
 <div class="timeline"><input id="time" aria-label="动作进度" type="range" min="0" max="1" step="0.001" value="0" disabled><output id="clock">0.00 / 0.00 秒</output></div>
 <div class="reference"><label><input id="bed" type="checkbox">参考床面</label><label>高度 <input id="bed-height" aria-label="参考床面高度" type="range" min="0" max="0.8" step="0.01" value="0.35"></label><span>只帮助观察接触位置，不修正原动作</span></div>
 <label id="clip-row" hidden>文件内片段 <select id="clip"></select></label>
 </div></section></div>`;
const el=<K extends HTMLElement>(id:string)=>document.getElementById(id) as K;
const viewport=el('viewport'),status=el('status'),play=el<HTMLButtonElement>('play'),slider=el<HTMLInputElement>('time');
const scene=new T.Scene();scene.background=new T.Color('#eeeee7');
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;viewport.append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,1,.01,100),orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.5;orbit.maxDistance=15;
scene.add(new T.HemisphereLight(0xffffff,0x858077,2));const light=new T.DirectionalLight(0xfff3e4,2.2);light.position.set(3,5,4);scene.add(light);
const grid=new T.GridHelper(8,40,0x999e91,0xd4d8cb);scene.add(grid);
const bed=new T.Mesh(new T.BoxGeometry(1.5,.10,2.6),new T.MeshStandardMaterial({color:0xb1c2ac,transparent:true,opacity:.6,roughness:1}));bed.position.set(0,.30,-.4);bed.visible=false;scene.add(bed);
let entries:Entry[]=[],current:Entry|undefined,model:T.Group|undefined,mixer:T.AnimationMixer|undefined,clips:T.AnimationClip[]=[],action:T.AnimationAction|undefined,helper:T.SkeletonHelper|undefined;
let time=0,duration=0,playing=true,manual=false,request=0,last=performance.now(),selectedClip=0,loading=false;
const bounds=new T.Box3();
function draw(){orbit.update();renderer.render(scene,camera);}
function resize(){camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight);if(current)fit(undefined,true);else draw();}
new ResizeObserver(resize).observe(viewport);
function fit(direction?:'front'|'side',preserveDirection=false){
 if(!current)return;const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 const distance=Math.max(size.y,size.x/camera.aspect,size.z/camera.aspect)*.5/Math.tan(T.MathUtils.degToRad(camera.fov/2))*1.35;
 const offset=preserveDirection?camera.position.clone().sub(orbit.target):direction==='front'?new T.Vector3(0,.15,1):direction==='side'?new T.Vector3(1,.15,0):new T.Vector3(1,.5,1.6);
 orbit.target.copy(center);camera.position.copy(center).add(offset.normalize().multiplyScalar(Math.max(2,distance)));orbit.update();draw();
}
function update(){
 if(mixer&&action){action.paused=false;action.enabled=true;mixer.setTime(time);action.paused=true;model!.updateMatrixWorld(true);}
 slider.value=String(time);el('clock').textContent=`${time.toFixed(2)} / ${duration.toFixed(2)} 秒`;play.textContent=playing?'暂停':'播放';draw();
}
function chooseClip(index:number){
 if(!mixer)return;selectedClip=index;mixer.stopAllAction();action=mixer.clipAction(clips[index]);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();duration=clips[index].duration;time=0;playing=true;slider.max=String(duration);update();
}
function disposeModel(root:T.Group){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();if(o instanceof T.SkinnedMesh)o.skeleton.dispose();}});}
async function choose(entry:Entry){
 const token=++request;loading=true;status.textContent='加载中…';
 for(const id of ['play','replay','fit','time','clip'])(el(id) as HTMLButtonElement).disabled=true;
 try{
  const loaded=await new GLTFLoader().loadAsync(base+'assets/'+encodeURIComponent(entry.file));
  if(token!==request){disposeModel(loaded.scene);return;}
  if(model){mixer?.stopAllAction();mixer?.uncacheRoot(model);scene.remove(model);disposeModel(model);}
  if(helper){scene.remove(helper);helper.dispose();}
  model=loaded.scene;scene.add(model);mixer=new T.AnimationMixer(model);clips=loaded.animations;current=entry;
  helper=new T.SkeletonHelper(model);helper.visible=el<HTMLInputElement>('skeleton').checked;scene.add(helper);
  bounds.min.fromArray(entry.bounds.min);bounds.max.fromArray(entry.bounds.max);grid.position.y=bounds.min.y-.015;
  const select=el<HTMLSelectElement>('clip');select.replaceChildren();clips.forEach((c,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${c.name} · ${c.duration.toFixed(2)} 秒`;select.append(option);});el('clip-row').hidden=clips.length<2;
  for(const b of el('list').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.id===entry.id));
  el('label').textContent=entry.label;status.textContent=`${clips.length} 个片段 · ${entry.bones} 骨骼`;
  loading=false;for(const id of ['play','replay','fit','time','clip'])(el(id) as HTMLButtonElement).disabled=false;
  chooseClip(0);fit();
 }catch(e){if(token===request){loading=false;status.textContent='加载失败，请确认本地动作包已解压';console.error(e);}}
}
play.onclick=()=>{if(time>=duration)time=0;playing=!playing;update();};
el('replay').onclick=()=>{time=0;playing=true;update();};el('fit').onclick=()=>fit();el('front').onclick=()=>fit('front');el('side').onclick=()=>fit('side');
slider.oninput=()=>{playing=false;time=Number(slider.value);update();};el<HTMLSelectElement>('clip').onchange=e=>chooseClip(Number((e.target as HTMLSelectElement).value));
el<HTMLInputElement>('skeleton').onchange=e=>{if(helper)helper.visible=(e.target as HTMLInputElement).checked;draw();};el<HTMLInputElement>('bed').onchange=e=>{bed.visible=(e.target as HTMLInputElement).checked;draw();};el<HTMLInputElement>('bed-height').oninput=e=>{bed.position.y=Number((e.target as HTMLInputElement).value)-.05;draw();};
function advance(seconds:number){if(playing&&action){time+=seconds*Number(el<HTMLSelectElement>('speed').value);if(time>=duration){if(el<HTMLInputElement>('loop').checked)time%=duration;else{time=duration;playing=false;}}}update();}
const w=window as any;w.advanceTime=(ms:number)=>{manual=true;advance(ms/1000);};w.render_game_to_text=()=>JSON.stringify({ready:!!model&&!loading,loading,source:'Meshy user export',candidate:current?.id,label:current?.label,count:entries.length,clip:selectedClip,time,duration,playing,loop:el<HTMLInputElement>('loop').checked,skeleton:helper?.visible,bed:bed.visible,bones:current?.bones,coordinateSystem:'Y up; unmodified source root motion; grid at sampled minimum mesh height'});
function tick(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(!manual&&!document.hidden)advance(dt);else draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);
fetch(base+'manifest.json').then(r=>{if(!r.ok)throw Error('manifest missing');return r.json();}).then(manifest=>{
 entries=manifest.entries;entries.forEach((entry,i)=>{const b=document.createElement('button');b.type='button';b.dataset.id=entry.id;b.setAttribute('aria-pressed','false');b.textContent=`${String(i+1).padStart(2,'0')}  ${entry.label}`;const selection=meshySelections.find(([,key])=>meshyMotions[key].sourceName===entry.id);if(selection){b.textContent+=' · '+selection[2];b.dataset.selected='true';}b.onclick=()=>void choose(entry);el('list').append(b);});return choose(entries[0]);
}).catch(e=>{status.textContent='没有找到本地动作包';console.error(e);});
