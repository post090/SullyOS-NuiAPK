import {furnitureGroup} from './furnitureDock.js';
import {ROOM_HALF} from './dimensions.js';
import {connectedRooms,roomOffset,boundaryBoxes,ROOM_STEP} from './topology.js';
import {moveFurniture,placementError} from './model.js';
export function layoutRoom(home,anchor,catalog){
 const rooms=connectedRooms(home,anchor.id,catalog),items=[],floorCells=[],obstacles=[];
 for(const room of rooms){const [dx,dz]=roomOffset(room,anchor);floorCells.push([dx-ROOM_HALF.x,dz-ROOM_HALF.z,dx+ROOM_HALF.x,dz+ROOM_HALF.z]);
  items.push(...room.items.map(i=>({...i,x:i.x+dx,z:i.z+dz,ownerRoomId:room.id})));
  obstacles.push(...boundaryBoxes(room,catalog).map(b=>[b[0]+dx,b[1],b[2]+dz,b[3]+dx,b[4],b[5]+dz]));
 }
 return {...anchor,items,floorCells,obstacles};
}
export function moveInHome(home,anchor,id,patch,catalog){
 const owner=home.rooms.find(r=>r.items.some(i=>i.id===id));if(!owner)throw Error('找不到家具');
 const a=catalog.find(a=>a.id===owner.items.find(i=>i.id===id).assetId),[ox,oz]=roomOffset(owner,anchor);
 if(a.building||['back','left','wall','ceiling'].includes(a.surface)){
  moveFurniture(owner,id,{...patch,...(patch.x!=null?{x:patch.x-ox}:{}),...(patch.z!=null?{z:patch.z-oz}:{})},catalog);return;
 }
 const composite=layoutRoom(home,anchor,catalog);moveFurniture(composite,id,patch,catalog);
 const parent=composite.items.find(i=>i.id===id),members=furnitureGroup(composite,id);
 const parentId=parent.supportId||parent.dockId,supportOwner=parentId&&composite.items.find(i=>i.id===parentId)?.ownerRoomId;
 const target=(supportOwner?home.rooms.find(r=>r.id===supportOwner):connectedRooms(home,anchor.id,catalog).find(r=>{const [x,z]=roomOffset(r,anchor);return Math.abs(parent.x-x)<=ROOM_STEP.x/2&&Math.abs(parent.z-z)<=ROOM_STEP.z/2;}))??owner;
 if(target!==owner&&target.items.length+members.length>100)throw Error('目标区域家具太多了');
 for(const r of home.rooms)r.items=r.items.filter(i=>!members.some(m=>m.id===i.id));
 const [tx,tz]=roomOffset(target,anchor);for(const {ownerRoomId,...i} of members)target.items.push({...i,x:i.x-tx,z:i.z-tz});
}
export function layoutError(home,catalog){
 for(const r of home.rooms){const composite=layoutRoom(home,r,catalog);for(const i of r.items){if(i.stored)continue;const a=catalog.find(a=>a.id===i.assetId);if(!a||a.building||!['floor','rug','tabletop'].includes(a.surface))continue;const why=placementError(i,composite,catalog);if(why)return why;}}
 return '';
}
