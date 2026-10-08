import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';

const params=new URLSearchParams(location.search);
const mobile=matchMedia('(pointer:coarse)').matches;
const quality=params.get('quality')??(mobile?'mobile':'high');
const scene=new THREE.Scene();scene.background=new THREE.Color('#d8c8d7');
const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
// Blender (x,y,z) -> glTF (x,z,-y).
camera.position.set(9,10,12);camera.lookAt(0,2.04,0);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='mobile'?1.5:2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
document.body.append(renderer.domElement);
renderer.info.autoReset=false;
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,2.04,0);controls.enableDamping=true;controls.enablePan=false;
controls.minAzimuthAngle=.25;controls.maxAzimuthAngle=1.1;
controls.minPolarAngle=.72;controls.maxPolarAngle=1.1;
controls.minZoom=.8;controls.maxZoom=1.35;
const hemi=new THREE.HemisphereLight('#ece9ff','#c3a1a7',1.6);scene.add(hemi);
function directional(color,intensity,x,y,z){const l=new THREE.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l);return l}
const key=directional('#fff1d9',2.3,-3,8,5);
key.castShadow=true;key.shadow.mapSize.set(quality==='mobile'?1024:2048,quality==='mobile'?1024:2048);
Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-5,near:.5,far:25});
key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=quality==='mobile'?12:24;key.shadow.blurSamples=16;
directional('#d7dbff',.85,5,5,-1);
directional('#ffe8d5',.55,-1,6,-4);
function point(color,power,pos,distance){const l=new THREE.PointLight(color,power,distance,2);l.position.set(...pos);scene.add(l)}
point('#afc6ff',1.2,[1.4,3.1,-1.65],4);
point('#ffd89f',1.8,[-1.65,1.75,-.92],2);
point('#ffd0aa',1.2,[-.42,3.5,-2.09],1.5);

const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#8b779b',opacity:.14}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.46;ground.receiveShadow=true;scene.add(ground);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
let ao;
if(quality!=='mobile'){
  ao=new GTAOPass(scene,camera,512,512);
  ao.blendIntensity=.6;
  ao.updateGtaoMaterial({radius:.24,distanceExponent:1.5,thickness:.6,scale:1});
  ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5});
  composer.addPass(ao);
}
const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.12,.35,1.3);
if(quality!=='mobile')composer.addPass(bloom);
composer.addPass(new SMAAPass());
composer.addPass(new OutputPass());
const floaters=[],tentacles=[],bubbles=[];
let ready=false,error=null,elapsed=0,manual=false,meshCount=0,triangleCount=0;
new GLTFLoader().load(new URL('./assets/jellyfish-home.glb',import.meta.url).href,gltf=>{
  const model=gltf.scene;
  model.traverse(o=>{
    if(o.userData.animated){floaters.push({o,y:o.position.y,...o.userData})}
    if(o.userData.tentacle&&o.parent.userData.animated)tentacles.push({o,z:o.rotation.z,phase:o.parent.userData.phase});
    if(o.userData.bubble)bubbles.push({o,y:o.position.y,phase:bubbles.length*.61});
    if(o.isMesh){
      meshCount++;triangleCount+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      o.castShadow=mats.every(m=>!m.transparent);o.receiveShadow=true;
      for(const m of mats){
        if(m.transparent){m.depthWrite=false;o.castShadow=false}
        if(m.name.startsWith('Water')){m.roughness=1}
      }
    }
  });
  scene.add(model);ready=true;window.__model=model;
},undefined,e=>{error=String(e);console.error(e)});
function resize(){
  const w=innerWidth,h=innerHeight,aspect=w/h;
  // The same square room is framed as one unit, with additional room below on phones.
  const verticalSpan=aspect<.85?9.3/aspect:10.25;
  camera.left=-verticalSpan*aspect/2;camera.right=verticalSpan*aspect/2;
  camera.top=verticalSpan/2;camera.bottom=-verticalSpan/2;
  camera.setViewOffset(w,h,0,aspect<.85?Math.round(h*.065):0,w,h);
  camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);
}
addEventListener('resize',resize);resize();
function update(t){
  for(const f of floaters)f.o.position.y=f.y+Math.sin(t*f.floatSpeed+f.phase)*f.floatAmplitude;
  for(const v of tentacles)v.o.rotation.z=v.z+Math.sin(t*.7+v.phase)*.025;
  for(const b of bubbles)b.o.position.y=b.y+((t*.025+b.phase)% .12);
}
function draw(){renderer.info.reset();composer.render()}
window.advanceTime=ms=>{manual=true;elapsed+=ms/1000;update(elapsed);controls.update();draw()};
window.render_game_to_text=()=>JSON.stringify({ready,error,quality,meshCount,triangleCount,animatedJellyfish:floaters.length,tentacleGroups:tentacles.length,time:elapsed,drawCalls:renderer.info.render.calls,frame:{width:innerWidth,height:innerHeight},coordinates:'Y up, square room centered at origin'});
window.__art={renderer,scene,camera,composer,controls,floaters};
let previous=performance.now();
function render(now){
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(!manual&&!document.hidden)elapsed+=dt;
  update(elapsed);controls.update();draw();requestAnimationFrame(render);
}
requestAnimationFrame(render);
addEventListener('keydown',e=>{if(e.key==='f'){if(document.fullscreenElement)document.exitFullscreen();else renderer.domElement.requestFullscreen()}});
