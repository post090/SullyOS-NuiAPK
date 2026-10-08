const legacyQuality = new URL(location.href);if (['original','reduced','preserved','6000','8000'].includes(legacyQuality.searchParams.get('quality'))) {legacyQuality.searchParams.set('quality','detail');window.history.replaceState(null,'',legacyQuality);}
import * as T from 'three';
import {setupGarmentFit} from './garment-fit.js';
import {createMotionPanel} from './motions.js';
import {BLANK_FINGERS} from '../../apps/room3d/chibi/blankFingers.ts';
if(new URLSearchParams(location.search).get('quality')==='reduced')document.querySelector('header span').textContent='减面候选 · 外套 3,848 面';
const approvedPose=await (await fetch('./default-pose.json')).json();
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
const $=id=>document.getElementById(id),host=$('viewport'),status=$('status');
const key='sully-cardigan-pose-v3', joints=['clavicle','upperArm','forearm','hand'],sides=['L','R'];
const blank=()=>Object.fromEntries(sides.flatMap(s=>joints.map(j=>[`${s}_${j}`,[0,0,0]])));
let schoolTop=true,schoolPants=true,schoolBodyIndex;
let animator;let curl=readCurl(approvedPose),state=blank(),history=[],model,bones={},rest={},syncing=false;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,100);
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;host.append(renderer.domElement);
scene.add(new T.HemisphereLight(0xffffff,0x879084,2.3));for(const [p,intensity] of [[[3,6,5],3],[[-4,3,1],1.4],[[0,4,-3],2]]){let l=new T.DirectionalLight(0xffffff,intensity);l.position.set(...p);scene.add(l);}
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,2.45,0);orbit.enableDamping=true;orbit.minDistance=3;orbit.maxDistance=20;
const gizmo=new TransformControls(camera,renderer.domElement);gizmo.setMode('rotate');gizmo.setSpace('local');gizmo.setSize(.75);const helper=gizmo.getHelper();scene.add(helper);
const render=()=>renderer.render(scene,camera);const selection=()=>`${$('side').value}_${$('joint').value}`;
function checkpoint(){history.push(JSON.stringify({state,curl}));if(history.length>60)history.shift();$('undo').disabled=false;}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,model:'narrow-cardigan',state,handCurl:curl,symmetric:$('symmetric').checked}));status.textContent='姿势已自动保存在本机。';}catch{status.textContent='无法自动保存，可使用“导出姿势”。';}}
function apply(){if(!model)return;animator?.stop();syncing=true;for(const [name,v] of Object.entries(state)){const sign=name.startsWith('L')?1:-1;const q=new T.Quaternion().setFromEuler(new T.Euler(T.MathUtils.degToRad(v[2]),-sign*T.MathUtils.degToRad(v[1]),-sign*T.MathUtils.degToRad(v[0]),'XYZ'));bones[name].quaternion.copy(rest[name]).multiply(q);}for(const side of sides){const sign=side==='L'?1:-1;for(const finger of BLANK_FINGERS){const a=finger.start,b=finger.tip,axis=new T.Vector3(b[2]-a[2],0,-sign*(b[0]-a[0])).normalize();for(const tip of [false,true]){const name=side+'_'+finger.name+(tip?'_tip':'');if(bones[name]){const amount=finger.name==='thumb'?(tip?1:.8):(tip?1.3:1.05);bones[name].quaternion.copy(rest[name]).multiply(new T.Quaternion().setFromAxisAngle(axis,curl*amount));}}}}model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});syncing=false;render();}
const rows=['下放 / 抬起','前后摆动','旋转 / 翻掌'].map((label,i)=>{let div=document.createElement('div');div.className='angle';let lab=document.createElement('label');lab.textContent=label;lab.htmlFor=`angle-${i}`;let number=document.createElement('input');number.type='number';number.setAttribute('aria-label',label+'角度');let slider=document.createElement('input');slider.id=`angle-${i}`;slider.type='range';for(const x of [number,slider]){x.min='-160';x.max='160';x.step='1';}number.onfocus=()=>checkpoint();slider.onpointerdown=()=>checkpoint();slider.onkeydown=e=>{if(e.key.startsWith('Arrow'))checkpoint();};for(const input of [number,slider])input.oninput=()=>{if(!Number.isFinite(input.valueAsNumber))return;let value=Math.max(-160,Math.min(160,input.valueAsNumber));state[selection()][i]=value;mirror();apply();refresh();save();};div.append(lab,number,slider);$('sliders').append(div);return {number,slider};});
function mirror(){if($('symmetric').checked){let name=selection(),other=(name[0]==='L'?'R':'L')+name.slice(1);state[other]=[...state[name]];}}
function refresh(){$('curl').value=String(Math.round(curl*100));$('curl-value').textContent=Math.round(curl*100)+'%';rows.forEach(({number,slider},i)=>{number.value=slider.value=String(Math.round(state[selection()][i]*10)/10);});if(model){gizmo.attach(bones[selection()]);helper.visible=$('handles').checked&&!animator?.active;gizmo.enabled=$('handles').checked&&!animator?.active;}}
for(const id of ['side','joint'])$(id).onchange=refresh;
$('symmetric').onchange=()=>{if($('symmetric').checked){checkpoint();const side=$('side').value;for(const joint of joints)state[`${side==='L'?'R':'L'}_${joint}`]=[...state[`${side}_${joint}`]];apply();refresh();}save();};
$('handles').onchange=()=>{refresh();render();};$('clothing').onchange=()=>{model?.traverse(o=>{if(o.isMesh&&(o.name.startsWith('Little_Cardigan')||o.name.startsWith('Sailor_')))o.visible=$('clothing').checked;});render();};
$('zero').onclick=()=>{checkpoint();state[selection()]=[0,0,0];mirror();apply();refresh();save();};$('undo').onclick=()=>{if(!history.length)return;const previous=JSON.parse(history.pop());state=previous.state;curl=previous.curl;apply();refresh();save();$('undo').disabled=!history.length;};$('undo').disabled=true;
function preset(name,record=true){if(record)checkpoint();if(name==='default'){state=validate(approvedPose);curl=readCurl(approvedPose);apply();refresh();if(record)save();return;}state=blank();for(const s of sides){state[`${s}_upperArm`][0]=name==='T'?0:name==='A'?45:76;state[`${s}_forearm`][0]=name==='relaxed'?-3:0;state[`${s}_hand`][0]=name==='relaxed'?3:0;}apply();refresh();if(record)save();}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));
function view(name){let v=name==='side'?[10,2.45,0]:name==='back'?[0,2.45,-10]:[0,2.45,10];orbit.target.set(0,2.45,0);camera.position.set(...v);orbit.update();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('home').onclick=()=>view('front');
gizmo.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(e.value)checkpoint();else save();});
gizmo.addEventListener('objectChange',()=>{if(syncing||!model)return;let name=selection(),sign=name[0]==='L'?1:-1,q=rest[name].clone().invert().multiply(bones[name].quaternion),e=new T.Euler().setFromQuaternion(q,'XYZ');state[name]=[-sign*T.MathUtils.radToDeg(e.z),-sign*T.MathUtils.radToDeg(e.y),T.MathUtils.radToDeg(e.x)].map(v=>Math.max(-160,Math.min(160,v)));mirror();apply();refresh();});
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('curl').onpointerdown=checkpoint;$('curl').onkeydown=e=>{if(e.key.startsWith('Arrow'))checkpoint();};$('curl').oninput=()=>{curl=Number($('curl').value)/100;apply();refresh();save();};
$('export').onclick=()=>download(new Blob([JSON.stringify({version:1,model:'narrow-cardigan',state,handCurl:curl,symmetric:$('symmetric').checked},null,2)],{type:'application/json'}),'cardigan-pose.json');
function readCurl(data){if(data.handCurl===undefined)return .45;if(typeof data.handCurl!=='number'||!Number.isFinite(data.handCurl)||data.handCurl<0||data.handCurl>1)throw Error('手指弯曲值无效');return data.handCurl;}
function validate(data){readCurl(data);if(data?.version!==1||data.model!=='narrow-cardigan'||!data.state)throw Error('不是这件开衫的姿势文件');let out=blank();for(const name of Object.keys(out)){let a=data.state[name];if(!Array.isArray(a)||a.length!==3||!a.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=160))throw Error('姿势角度无效');out[name]=[...a];}return out;}
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{let f=$('file').files[0];if(!f)return;let data=JSON.parse(await f.text()),next=validate(data);checkpoint();state=next;curl=readCurl(data);$('symmetric').checked=data.symmetric===true;apply();refresh();save();}catch(e){status.textContent='导入失败：'+e.message;}finally{$('file').value='';}};
$('png').onclick=()=>{let vis=helper.visible;helper.visible=false;render();renderer.domElement.toBlob(b=>{if(b)download(b,'cardigan-pose.png');},'image/png');helper.visible=vis;render();};
$('glb').onclick=async()=>{const b=$('glb');b.disabled=true;try{if(!animator?.active)apply();let data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});download(new Blob([data],{type:'model/gltf-binary'}),'cardigan-pose.glb');status.textContent='已导出当前姿势模型。';}catch(e){status.textContent='导出失败：'+e.message;}finally{b.disabled=false;}};
new ResizeObserver(()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);render();}).observe(host);
view('front');let previousFrame;renderer.setAnimationLoop(ms=>{const dt=previousFrame===undefined?0:Math.min(.1,(ms-previousFrame)/1000);previousFrame=ms;animator?.tick(dt);orbit.update();render();});
for(const el of document.querySelectorAll('aside button,aside input,aside select'))el.disabled=true;
try{const result=await new GLTFLoader().loadAsync(({'lace-midboots':'./clothing-0920b/lace-midboots-rig.glb?v=straight-shaft-r3','buckle-shoes':'./clothing-0920b/buckle-shoes-rig.glb','tall-boots':'./clothing-0920b/tall-boots-rig.glb?v=straight-shaft-r3','collar-shirt':'./clothing-0920b/collar-shirt-rig.glb','belt-coat':'./clothing-0920b/belt-coat-rig.glb','ruffle-apron':'./clothing-0920b/ruffle-apron-rig.glb','bow-headband':'./clothing-0920b/bow-headband-rig.glb','school-blazer':'./clothing-0920b/school-blazer-rig.glb','stand-collar':'./clothing-0920b/stand-collar-rig.glb','hood-parka':'./clothing-0920b/hood-parka-rig.glb','necktie':'./clothing-0920b/necktie-rig.glb','bow-tie':'./clothing-0920b/bow-tie-rig.glb','shoe-geta':'./shoes/geta-rig.glb','shoe-boots':'./shoes/boots-rig.glb','shoe-sneakers':'./shoes/sneakers-rig.glb','lower-shorts':'./shoes/shorts-rig.glb','lower-long-skirt':'./lowerwear/long-skirt-rig.glb','lower-straight':'./lowerwear/straight-rig.glb','lower-cargo':'./lowerwear/cargo-rig.glb','lower-cropped':'./lowerwear/cropped-rig.glb','sailor-girl':'./sailor-girl.glb','sailor-school':'./sailor-school-user.glb?v=user1','sailor1':'./sailor-1.glb?v=source3','sailor2':'./sailor-2.glb?v=source3','sailor1-original':'./sailor-1-original.glb','sailor2-original':'./sailor-2-original.glb','detail':'./cardigan-rig-detail.glb?v=chunky2','reduced':'./cardigan-rig-reduced.glb','preserved':'./cardigan-rig-preserved.glb','6000':'./cardigan-rig-6000.glb','8000':'./cardigan-rig-8000.glb'}[new URLSearchParams(location.search).get('quality')]??"./cardigan-rig-detail.glb"));model=result.scene;scene.add(model);model.traverse(o=>{if(o.isBone){bones[o.name]=o;rest[o.name]=o.quaternion.clone();}if(o.isMesh){o.frustumCulled=false;o.material.side=T.DoubleSide;}});if(new URLSearchParams(location.search).get('quality')?.match(/^sailor-(school|girl)$/))setupSchoolParts();for(const name of Object.keys(state))if(!bones[name])throw Error('模型缺少关节 '+name);preset('default',false);try{let raw=localStorage.getItem(key);if(raw){let data=JSON.parse(raw);state=validate(data);curl=readCurl(data);$('symmetric').checked=data.symmetric!==false;apply();refresh();}}catch{}for(const el of document.querySelectorAll('aside button,aside input,aside select'))el.disabled=false;$('undo').disabled=true;animator=createMotionPanel({model,bones,host:$('motion-panel'),camera,orbit,onManual:()=>{apply();refresh();},onMode:active=>{for(const el of document.querySelectorAll('#sliders input,#curl,#side,#joint,#symmetric,#zero,#undo,#export,#import'))el.disabled=active;helper.visible=!active&&$('handles').checked;gizmo.enabled=!active&&$('handles').checked;}});status.textContent=new URLSearchParams(location.search).get('quality')==='detail'?'罗纹、口袋收边与独立纽扣候选；落肩露臂处已补形。':'可在动作检查中逐项查看。';window.poseStudio={motions:animator,getAllBones:()=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.quaternion.toArray()])),getState:()=>structuredClone(state),getCurl:()=>curl,getFingers:()=>Object.fromEntries(Object.entries(bones).filter(([n])=>/thumb|index|middle|ring|pinky/.test(n)).map(([n,b])=>[n,b.quaternion.toArray()])),getBones:()=>Object.fromEntries(Object.keys(state).map(n=>[n,bones[n].quaternion.toArray()])),preset};}catch(e){status.textContent='加载失败：'+e.message;console.error(e);}



const quality=new URLSearchParams(location.search).get("quality")||"detail";const qualitySelect=document.createElement('select');qualitySelect.setAttribute('aria-label','模型精度对比');for(const [value,label] of [['lace-midboots','鞋履 · 系带中筒靴'],['buckle-shoes','鞋履 · 搭扣低帮鞋'],['tall-boots','鞋履 · 简洁长靴'],['collar-shirt','服装 · 翻领长袖衬衫'],['belt-coat','服装 · 系带长外套'],['ruffle-apron','服装 · 荷叶边围裙'],['bow-headband','头饰 · 蝴蝶结头饰'],['school-blazer','服装 · 蝴蝶结制服外套'],['stand-collar','服装 · 立领制服上衣'],['hood-parka','服装 · 连帽宽松外套'],['necktie','配饰 · 经典领带'],['bow-tie','配饰 · 蝴蝶领结'],['shoe-geta','鞋履 · 木屐'],['shoe-boots','鞋履 · 系带短靴'],['shoe-sneakers','鞋履 · 厚底运动鞋'],['lower-shorts','下装 · 宽松短裤'],['lower-long-skirt','下装 · 腰带长裙'],['lower-straight','下装 · 直筒长裤'],['lower-cargo','下装 · 口袋工装裤'],['lower-cropped','下装 · 宽腿九分裤'],['sailor-girl','女款水手服 · 短袖百褶裙'],['sailor-school','新版水手服 · 纯色试穿'],['sailor1','源精度 · 长袖百褶裙 / 194,676 面'],['sailor2','源精度 · 短袖短裤 / 241,158 面'],['detail','Q版粗罗纹 · 5,720 面'],])qualitySelect.add(new Option(label,value));qualitySelect.value=quality;qualitySelect.onchange=()=>{save();location.search='?quality='+qualitySelect.value;};document.querySelector('.intro').append(qualitySelect);document.querySelector('header span').textContent=qualitySelect.selectedOptions[0].textContent;






if(quality.startsWith('sailor')){document.querySelector('header b').textContent='水手服 · 姿势工作台';document.title='水手服 · 姿势工作台';}




function updateSchoolVisibility(){
 if(!model)return;
 const topOn=$('clothing').checked&&schoolTop,pantsOn=$('clothing').checked&&schoolPants;
 const girl=new URLSearchParams(location.search).get('quality')==='sailor-girl';
 model.traverse(o=>{if(o.isMesh&&o.name.startsWith('Sailor_'))o.visible=o.name.startsWith('Sailor_pants')||o.name.startsWith('Sailor_skirt')?pantsOn:o.name.startsWith('Sailor_shoes')||o.name.startsWith('Sailor_socks')?$('clothing').checked:topOn;});
 const body=model.getObjectByName('Mesh_0');if(!body)return;const g=body.geometry,pos=g.attributes.position;
 if(!schoolBodyIndex)schoolBodyIndex=Array.from(g.index.array);
 const kept=[];
 for(let i=0;i<schoolBodyIndex.length;i+=3){const ids=schoolBodyIndex.slice(i,i+3);
  const inTop=ids.every(v=>{const x=Math.abs(pos.getX(v)),y=pos.getY(v);return (x<.49&&y>2.32&&y<3.24)||(x>.25&&x<(girl?.71:1.44)&&y>2.84&&y<3.40);});
  // The waist is at 2.49: preserve skin above it when the top is removed.
  const inPants=ids.every(v=>pos.getY(v)>1.81&&pos.getY(v)<2.45);
  const inShoes=girl&&$('clothing').checked&&ids.every(v=>pos.getY(v)<.94);
  if(!(topOn&&inTop)&&!(pantsOn&&inPants)&&!inShoes)kept.push(...ids);
 }
 g.setIndex(kept);render();
}
function setupSchoolParts(){
 const panel=document.createElement('div');panel.className='row';
 for(const [id,label] of [['top-piece','上衣'],['pants-piece','裤子']]){const lab=document.createElement('label');lab.className='toggle';const input=document.createElement('input');input.id=id;input.type='checkbox';input.checked=true;input.onchange=()=>{if(id==='top-piece')schoolTop=input.checked;else schoolPants=input.checked;updateSchoolVisibility();};lab.append(input,document.createTextNode(label));panel.append(lab);}
 $('clothing').closest('label').after(panel);updateSchoolVisibility();$('handles').checked=false;
 $('clothing').onchange=updateSchoolVisibility;
 if(new URLSearchParams(location.search).get('quality')==='sailor-girl')$('pants-piece').parentElement.lastChild.textContent='裙子';
 const paintLink=document.createElement('a');paintLink.href='./paint.html?texture=user';paintLink.textContent='打开男款贴图画室';paintLink.style.display='block';panel.after(paintLink);
}

if (model && schoolBodyIndex) setupGarmentFit({ model, bodyIndex: schoolBodyIndex });




import {setupLowerwear} from './lowerwear-controls.js';
if (model) setupLowerwear({model:model});

if (new URLSearchParams(location.search).get('quality')?.startsWith('lower-')) {document.querySelector('header b').textContent='下装 · 姿势工作台';document.title='下装 · 姿势工作台';}

import {setupFootwear} from './footwear-controls.js';
if (model) setupFootwear({model:model});

import {setupApparel} from './apparel-controls.js';
if (model) setupApparel({model:model});
