import * as THREE from 'three';

// One lazy renderer produces transparent portraits from the real, recolored
// meshes. Cards share cached PNGs; opening a panel never starts a second loop.
export function createPetPortraits(){
 let renderer;const cache=new Map();
 return {get(key,model){
  if(cache.has(key))return cache.get(key);if(!model)return '';
  renderer??=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(256,224,false);renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),root=model.clone(true);root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);scene.add(root);
  scene.add(new THREE.HemisphereLight('#fff9ed','#aab6a3',2.5));const light=new THREE.DirectionalLight('#fff6e5',2);light.position.set(-3,5,5);scene.add(light);
  const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),span=Math.max(size.x*.88,size.y,size.z*.65)*1.22;
  const camera=new THREE.OrthographicCamera(-span*256/224/2,span*256/224/2,span/2,-span/2,.01,30);camera.position.copy(center).add(new THREE.Vector3(.24,.30,2.8));camera.lookAt(center);renderer.render(scene,camera);
  const url=renderer.domElement.toDataURL('image/png');cache.set(key,url);if(cache.size>40)cache.delete(cache.keys().next().value);return url;
 },dispose(){cache.clear();renderer?.dispose();renderer?.forceContextLoss();renderer=null;}};
}
