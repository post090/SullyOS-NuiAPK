import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildBody,loadBody} from '../../apps/room3d/chibi/FbxBody';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';
import type {Motion,Posture} from '../../apps/room3d/chibi/types';

async function start(){
 const params=new URLSearchParams(location.search),proportions={headSize:params.has('headSize')?Number(params.get('headSize')):undefined,bodyHeight:Number(params.get('bodyHeight')??1)};
 const w=window as any,scene=new T.Scene();scene.background=new T.Color('#eee8e1');
 scene.add(new T.HemisphereLight('#fff9f2','#bbb0be',2));const sun=new T.DirectionalLight('#ffffff',1.6);sun.position.set(-3,6,5);scene.add(sun);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
 const camera=new T.OrthographicCamera(-5.8,5.8,3.5,-3.5,.1,40);camera.position.set(0,2.8,12);camera.lookAt(0,2.8,0);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=4;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f0d2be';ctx.fillRect(0,0,4,4);const skin=new Image();skin.src=canvas.toDataURL();await skin.decode();
 const source=await loadBody(),bodies=[0,1].map(i=>{const body=buildBody(source,{skin,fronthair:skin},'skin',{bodyShape:'blank',...proportions,layers:{},extras:[]});body.root.position.x=i?3.4:0;scene.add(body.root);const outfit=dressHoodie(body.rig!);body.resources.push(...outfit.resources);return body});
 source.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});
 // Optional high-resolution geometry-only source stays in ignored output, never in the app bundle.
 const original=new T.Group();scene.add(original);
 // Use ?reference=1 after generating the local comparison GLB.
 if(new URLSearchParams(location.search).has('reference')){const loaded=await new GLTFLoader().loadAsync('/output/hoodie-shoulder/source.glb');original.add(loaded.scene);original.scale.setScalar(5.2966);original.position.x=-3.4;}
 let yaw=0,motion:Motion='wave-calm',posture:Posture='standing',detail=false;
 const render=()=>{scene.updateMatrixWorld(true);renderer.render(scene,camera)};
 const draw=()=>{bodies.forEach((b,i)=>{for(let n=0;n<=30;n++)b.animate(n/30,i?motion:'idle',posture);b.root.rotation.y=yaw});original.rotation.y=yaw;render()};
 w.shoulderPose=(m:Motion,p:Posture='standing')=>{motion=m;posture=p;draw()};w.shoulderView=(v:number)=>{yaw=v;draw()};
 w.shoulderDetail=()=>{detail=!detail;camera.zoom=detail?2.1:1;camera.position.x=detail?2:0;camera.position.y=detail?3.1:2.8;camera.lookAt(camera.position.x,camera.position.y,0);camera.updateProjectionMatrix();draw()};
 w.advanceTime=()=>draw();w.render_game_to_text=()=>JSON.stringify({motion,posture,yaw,detail,...proportions});
 w.shoulderReady=true;draw();
}
start();
