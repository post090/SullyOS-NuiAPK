import * as THREE from 'three';

// One reusable floor marker. No textures, lighting, shadows or persistent loop.
export function createWalkFeedback({reducedMotion=false}={}){
 const root=new THREE.Group();root.name='walk-destination';root.visible=false;
 const make=(geometry,color)=>{
  const material=new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.raycast=()=>{};root.add(mesh);return mesh;
 };
 const rim=make(new THREE.RingGeometry(.255,.345,40),'#ffffff');
 const ring=make(new THREE.RingGeometry(.275,.325,40),'#329d77');ring.position.y=.002;
 const dot=make(new THREE.CircleGeometry(.055,16),'#329d77');dot.position.y=.003;
 const cross=new THREE.Group();root.add(cross);
 for(const angle of [-Math.PI/4,Math.PI/4]){
  const bar=make(new THREE.PlaneGeometry(.23,.045),'#d75560');bar.rotation.z=angle;bar.position.y=.003;cross.add(bar);
 }
 let state=null;
 function clear(){state=null;root.visible=false;}
 function show(position,status,time){state={position:[...position],status,start:time};}
 function arrive(time){if(state?.status==='walking'){state.status='arrived';state.start=time;}}
 function update(time,origin=[0,0],visible=true,scale=1){
  if(!state){root.visible=false;return;}
  const age=Math.max(0,time-state.start),duration=state.status==='blocked'?1:.65;
  if(state.status!=='walking'&&age>=duration){clear();return;}
  root.visible=visible;
  root.position.set(state.position[0]-origin[0],state.position[1],state.position[2]-origin[1]);
  const pulse=reducedMotion?1:1+.24*Math.sin(Math.min(1,age/.32)*Math.PI);
  root.scale.setScalar(pulse*scale);
  const opacity=state.status==='walking'||reducedMotion?1:Math.min(1,(duration-age)/.25);
  root.traverse(o=>{if(o.isMesh)o.material.opacity=opacity;});
  const blocked=state.status==='blocked';dot.visible=!blocked;cross.visible=blocked;
  ring.material.color.set(blocked?'#d75560':'#329d77');
 }
 return {root,show,arrive,clear,update,
  get active(){return !!state;},
  inspect:()=>state?{status:state.status,position:[...state.position],visible:root.visible}:null,
  dispose(){clear();root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});root.removeFromParent();}
 };
}
