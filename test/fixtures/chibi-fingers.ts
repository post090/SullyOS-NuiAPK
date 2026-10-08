import * as T from 'three';
import {createBlankBody,BLANK_SCALE} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
const scene=new T.Scene();scene.background=new T.Color('#eee9e3');scene.add(new T.HemisphereLight('#fff9f2','#bbb0be',2));const sun=new T.DirectionalLight('#fff',1.6);sun.position.set(-3,6,5);scene.add(sun);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const root=new T.Group(),hair=new T.Group(),g=createBlankBody('skin');g.clearGroups();const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:'#d6c3b4',roughness:1}));root.add(mesh,hair);scene.add(root);const rig=bindBlankBody(mesh,hair);
const helper=new T.SkeletonHelper(root);helper.visible=false;scene.add(helper);
let side:'L'|'R'='L';
const camera=new T.OrthographicCamera();
function draw(){
 root.rotation.x=-Math.PI/3;root.updateMatrixWorld(true);const center=root.localToWorld(new T.Vector3((side==='L'?1:-1)*.336,.587,.009).multiplyScalar(BLANK_SCALE));
 const half=.52,aspect=(innerWidth/3)/innerHeight;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.near=.1;camera.far=30;camera.position.copy(center).add(new T.Vector3(0,0,8));camera.lookAt(center);camera.updateProjectionMatrix();
 renderer.setScissorTest(true);for(let i=0;i<3;i++){rig.setPose('bind');rig.setHandCurl(side,[0,.4,1][i]);root.updateMatrixWorld(true);rig.skeleton.update();renderer.setViewport(i*innerWidth/3,0,innerWidth/3,innerHeight);renderer.setScissor(i*innerWidth/3,0,innerWidth/3,innerHeight);renderer.render(scene,camera);}renderer.setScissorTest(false);
}
document.querySelector('#side')!.addEventListener('click',()=>{side=side==='L'?'R':'L';draw();});document.querySelector('#skeleton')!.addEventListener('click',()=>{helper.visible=!helper.visible;draw();});
Object.assign(window,{advanceTime:draw,render_game_to_text:()=>JSON.stringify({side,bones:rig.skeleton.bones.length,poses:['open','relaxed','fist'],skeleton:helper.visible}),fingersReady:true});draw();
