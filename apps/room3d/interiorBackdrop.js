import * as THREE from 'three';
import {ROOM_HALF} from './dimensions.js';

// Scenery only: kept outside content, so it cannot become a walking surface,
// furniture target, collision boundary, or part of the whole-house camera fit.
export function createInteriorBackdrop(){
 const root=new THREE.Group();root.name='interior-backdrop';
 function clear(){root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!o.userData.borrowedMaterial)o.material.dispose();}});root.clear();}
 function update(room,walls,floor){
  clear();
  function plane(w,h,x,y,z,rx,ry,color){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
   mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);return mesh;
  }
  if(floor)root.add(floor);else plane(80,80,0,.149,0,-Math.PI/2,0,room.floor||'#dfc7ad');
  // Leave the original wall rectangle open, including its windows and doors.
  const x=ROOM_HALF.x,z=ROOM_HALF.z,top=4.85,reach=40;
  function extend(back,sign,edge){
   const half=back?x:z;
   for(const side of [-1,1]){
    const along=side*(half+reach/2);
    plane(reach,top,back?along:sign*(x+.12),top/2,back?sign*(z+.12):along,0,back?0:Math.PI/2,room.wall).userData.boundaryEdge=edge;
   }
   plane(2*half+2*reach,reach,back?0:sign*(x+.12),top+reach/2,back?sign*(z+.12):0,0,back?0:Math.PI/2,room.wall).userData.boundaryEdge=edge;
  }
  extend(true,-1,'back');extend(false,-1,'left');extend(true,1,'front');extend(false,1,'right');
 }
 return {root,update,dispose:clear};
}
