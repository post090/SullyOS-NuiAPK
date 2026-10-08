import * as T from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
const host=document.getElementById('view')!;
const renderer=new T.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); host.appendChild(renderer.domElement);
const scene=new T.Scene(); scene.add(new T.HemisphereLight('#ffffff','#b2a696',2.5));
const light=new T.DirectionalLight('#fff0dc',2);light.position.set(-3,5,6);scene.add(light);
const camera=new T.PerspectiveCamera(32,1,.01,100);camera.position.set(0,.2,3.8);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
new FBXLoader().load('/experiments/chibi/reference.fbx', model=>{
const bounds=new T.Box3().setFromObject(model), center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
model.position.sub(center); const group=new T.Group();group.add(model);group.scale.setScalar(2/size.y);
model.traverse(o=>{if(o instanceof T.Mesh)o.material=new T.MeshStandardMaterial({color:'#efc8ac',roughness:1});});scene.add(group);
},undefined,e=>{host.textContent=String(e)});
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.position.z=Math.max(3.8,3/camera.aspect);camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
