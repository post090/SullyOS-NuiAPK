import {gamingPoint,clearance} from './gaming.js';
import {seatTransform} from './seating.js';
import {dockSlots} from './furnitureDock.js';
import {placementError,uid,boxes} from './model.js';
import {boundaryBoxes,insideFloors} from './topology.js';
import {ROOM_HALF} from './dimensions.js';
const overlap=(a,b)=>a[0]<b[3]-.015&&a[3]>b[0]+.015&&a[1]<b[4]-.015&&a[4]>b[1]+.015&&a[2]<b[5]-.015&&a[5]>b[2]+.015;
export function diningActivities(room,catalog,{headWidth=1.5}={}){
 const results=[];
 for(const chair of room.items.filter(i=>!i.stored&&i.dockId)){
  const table=room.items.find(i=>i.id===chair.dockId&&!i.stored),a=catalog.find(a=>a.id===table?.assetId),c=catalog.find(a=>a.id===chair.assetId);if(!a?.dining||!c?.seats?.length)continue;
  const seat={roomId:room.id,itemId:chair.id,seatId:c.seats[0].id},pose=seatTransform(room,catalog,seat),t=table.rotation*Math.PI/180,dx=pose.position[0]-table.x,dz=pose.position[2]-table.z;
  const local=[Math.cos(t)*dx-Math.sin(t)*dz,0,Math.sin(t)*dx+Math.cos(t)*dz],clamp=(v,h)=>Math.max(-h,Math.min(h,v));
  const meal=gamingPoint(table,[clamp(local[0],a.size[0]/2-.105),a.support.height+.06,clamp(local[2],a.size[2]/2-.105)]),cos=Math.cos(pose.rotation),sin=Math.sin(pose.rotation),mx=meal[0]-pose.position[0],mz=meal[2]-pose.position[2];
  const center=[(cos*mx-sin*mz)/.7,(meal[1]-pose.position[1])/.7,(sin*mx+cos*mz)/.7],hands=[[-.26,center[1],center[2]],[.26,center[1],center[2]]];
  const match=dockSlots(table,chair,room,catalog).find(s=>s.dockSlot===chair.dockSlot);let reason=!match||Math.hypot(match.x-chair.x,match.z-chair.z)>.02||match.rotation!==chair.rotation?'把餐椅吸附到餐桌旁':'';
  if(!reason)reason=clearance(room,catalog,pose,[chair.id],headWidth);
  if(!reason&&(center[1]<.20||center[1]>.85||center[2]<.12||center[2]>.83||Math.abs(center[0])>.30))reason='桌椅高度或距离不合适，小手够不到';
  const bowl=[meal[0]-.16,meal[1]-.04,meal[2]-.16,meal[0]+.16,meal[1]+.16,meal[2]+.16];
  if(!reason&&room.items.some(i=>!i.stored&&i.supportId===table.id&&boxes(i,catalog.find(a=>a.id===i.assetId)).some(b=>overlap(bowl,b))))reason='把面前的桌面腾出来放碗';
  results.push({roomId:room.id,itemId:table.id,stationId:chair.id,kind:'eat',label:'坐到餐桌边吃饭',seat,...pose,hands,meal:center,dependencies:[chair.id],reason});
 }
 return [...results,...islandDiningActivities(room,catalog,{headWidth})];
}
// Existing showroom saves have no dock links. Match the reviewed island/bench
// combination geometrically, without moving furniture or rewriting the save.
export function islandDiningActivities(room,catalog,{headWidth=1.5}={}){
 const results=[];
 for(const table of room.items.filter(i=>!i.stored&&i.assetId==='show_kitchen_island')){
  const a=catalog.find(a=>a.id===table.assetId),props=room.items.filter(i=>!i.stored&&i.supportId===table.id);
  const breakfast=props.find(i=>i.assetId==='kitchen_ref_breakfast');
  for(const chair of room.items.filter(i=>!i.stored&&i.assetId==='show_kitchen_bench')){
   const c=catalog.find(a=>a.id===chair.assetId);
   for(const slot of c.seats){
   const seat={roomId:room.id,itemId:chair.id,seatId:slot.id,dining:true},pose=seatTransform(room,catalog,seat);
   const t=table.rotation*Math.PI/180,dx=chair.x-table.x,dz=chair.z-table.z,x=Math.cos(t)*dx-Math.sin(t)*dz,z=Math.sin(t)*dx+Math.cos(t)*dz;
   if(Math.abs(x)>.35||z<1.1||z>1.8||Math.cos(pose.rotation-t)>-.98)continue;
   const seatX=Math.cos(t)*(pose.position[0]-table.x)-Math.sin(t)*(pose.position[2]-table.z);
   const meal=gamingPoint(table,[seatX,a.support.height+.045,a.size[2]/2-.075]),cos=Math.cos(pose.rotation),sin=Math.sin(pose.rotation),mx=meal[0]-pose.position[0],mz=meal[2]-pose.position[2];
   const center=[(cos*mx-sin*mz)/.7,(meal[1]-pose.position[1])/.7,(sin*mx+cos*mz)/.7];
   let reason=!breakfast?'在中岛上摆好早餐杯盘托盘':'';
   reason||=clearance(room,catalog,pose,[chair.id],headWidth);
   if(!reason&&(center[1]<.2||center[1]>1||center[2]<.12||center[2]>1||Math.abs(center[0])>.3))reason='把餐边长凳靠近中岛，让小手够得到';
   const bowl=[meal[0]-.12,meal[1]-.045,meal[2]-.12,meal[0]+.12,meal[1]+.12,meal[2]+.12];
   if(!reason&&props.some(i=>boxes(i,catalog.find(a=>a.id===i.assetId)).some(b=>overlap(bowl,b))))reason='把面前的桌面腾出来放碗';
   results.push({roomId:room.id,itemId:table.id,stationId:chair.id+':'+slot.id,kind:'eat',label:'坐到中岛'+slot.label+'吃饭',seat,...pose,hands:[[-.20,center[1],center[2]],[.20,center[1],center[2]]],meal:center,dependencies:[chair.id,...breakfast?[breakfast.id]:[]],reason});
   }
  }
 }
 return results;
}
export function diningPreset(catalog){
 const table={id:uid(),assetId:'dining_table',x:0,y:.15,z:0,rotation:0,color:null,stored:false},room={items:[table]};
 for(const index of [0,1]){const chair={id:uid(),assetId:'dining_chair',x:0,y:.15,z:0,rotation:0,color:null,stored:false};room.items.push(dockSlots(table,chair,room,catalog)[index]);}return room.items;
}
export function placeDiningPreset(room,catalog){
 const base=diningPreset(catalog);for(const dz of [0,-.4,.4,-.8,.8])for(const dx of [0,-.6,.6,-1.2,1.2]){const items=base.map(i=>({...i,x:i.x+dx,z:i.z+dz})),test={...room,items:[...room.items,...items]};if(items.every(i=>!placementError(i,test,catalog))&&diningActivities(test,catalog).filter(a=>items.some(i=>i.id===a.itemId)).every(a=>!a.reason))return items;}
 throw Error('餐桌和两张椅子放不下啦，先腾出一些空间');
}
export function fridgeOpenError(item,room,catalog,resident){
 const a=catalog.find(a=>a.id===item?.assetId);if(a?.appliance!=='fridge'||item.stored)return '冰箱不在这里了';
 const half=a.size[0]/2,depth=a.size[2]/2,pts=[[-half,0,depth],[half,0,depth+half+.08]].flatMap(p=>[gamingPoint(item,p),gamingPoint(item,[-p[0],a.size[1],p[2]])]);
 const min=[0,1,2].map(k=>Math.min(...pts.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...pts.map(p=>p[k]))),b=[...min,...max],rect=[min[0],min[2],max[0],max[2]];
 if(room.floorCells?!insideFloors(rect,room.floorCells):Math.abs(rect[0])>ROOM_HALF.x||Math.abs(rect[2])>ROOM_HALF.x||Math.abs(rect[1])>ROOM_HALF.z||Math.abs(rect[3])>ROOM_HALF.z)return '门前空间不够，冰箱往里挪一点';
 const obstacles=[...boundaryBoxes(room,catalog),...room.items.filter(i=>!i.stored&&i.id!==item.id&&!['rug','ceiling'].includes(catalog.find(a=>a.id===i.assetId)?.surface)).flatMap(i=>boxes(i,catalog.find(a=>a.id===i.assetId)))];
 if(resident)obstacles.push([resident[0]-.45,resident[1],resident[2]-.4,resident[0]+.45,resident[1]+1.5,resident[2]+.4]);
 return obstacles.some(o=>overlap(b,o))?'冰箱门前被挡住了，留一点开门空间':'';
}
