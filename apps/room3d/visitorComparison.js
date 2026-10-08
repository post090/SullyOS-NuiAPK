import {ROOM_HALF} from './dimensions.js';
import {Box3,Vector3} from 'three';

export function visitorFootprintWidth(visitor){
 // updateWorldMatrix alone does not refresh SkinnedMesh.bindMatrixInverse.
 // A reparented actor otherwise measures using its former parent's transform.
 visitor.root.updateWorldMatrix(true,true);visitor.root.updateMatrixWorld(true);
 visitor.rig?.skeleton.update();
 const bounds=new Box3();
 visitor.root.traverse(o=>{if(o.isMesh&&o.name==='chibi-body'){
  if(o.isSkinnedMesh)o.computeBoundingBox();
  bounds.union(new Box3().setFromObject(o));
 }});
 return bounds.isEmpty()?1.5:Math.max(1.5,bounds.getSize(new Vector3()).x+.08);
}

// A waiting test actor uses the same furniture clearance as the active actor.
// Keep an existing valid spot instead of moving it whenever the camera redraws.
export function comparisonSpot(map,{offset=[0,0],width,activeWidth,active,preferred,reserved=[]}){
 const gap=(width+activeWidth)/2+.12;
 const valid=([x,y,z])=>Math.abs(x)<=ROOM_HALF.x-width/2-.1&&Math.abs(z)<=ROOM_HALF.z-width/2-.1&&
  [active,...reserved].every(p=>Math.abs(x-p[0])>=gap||Math.abs(z-p[2])>=gap)&&map.free(x+offset[0],z+offset[1]);
 if(preferred&&valid(preferred))return preferred;
 for(let z=ROOM_HALF.z-width/2-.2;z>=-ROOM_HALF.z+width/2+.2;z-=.2){
  for(let x=-ROOM_HALF.x+width/2+.2;x<=ROOM_HALF.x-width/2-.2;x+=.2){
   const point=[x,.18,z];if(valid(point))return point;
  }
 }
 return null;
}
