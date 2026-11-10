import {createHome,uid,clone} from './model.js';
import {furnishShowroom,SHOWROOMS} from './showrooms.js';
import {bathroomHome} from './bathroomLayout.js';
import {applyRoomPalette,ROOM_PALETTES} from './roomPalettes.js';
import {STARTER_ROOMS} from './starterRooms.js';

export {STARTER_ROOMS} from './starterRooms.js';
export function createStarterHome(catalog,palette='sage'){
 if(!ROOM_PALETTES[palette])throw Error('请选择房屋配色');
 const home=createHome(catalog);
 home.rooms=STARTER_ROOMS.map(spec=>{
  let room={id:spec.id,name:spec.name,x:spec.x,z:0,level:spec.level,wall:'#f0e6d5',items:[]};
  if(spec.kind==='bathroom')room={...bathroomHome(catalog).rooms[0],id:room.id,x:spec.x,z:0,level:spec.level};
  else if(spec.kind)furnishShowroom(room,spec.kind,catalog,{compact:false});
  room.name=spec.name;
  const ids=new Map(room.items.map(item=>[item.id,uid()]));
  room.items=room.items.map(item=>({...item,id:ids.get(item.id),...(item.supportId?{supportId:ids.get(item.supportId)}:{}),...(item.dockId?{dockId:ids.get(item.dockId)}:{})}));
  applyRoomPalette(room,palette,catalog);
  return room;
 });
 home.activeRoomId=home.rooms[0].id;home.homePalette=palette;
 return home;
}
// Room IDs and names belong to the user's home, never to the generated template.
export function hasDefaultRoomLayout(home,room){
 return !!SHOWROOMS[room.defaultTemplate?.kind]||!!ROOM_PALETTES[home.homePalette]&&STARTER_ROOMS.some(spec=>spec.x===room.x&&spec.level===room.level&&room.z===0)||room.x===0&&room.z===0&&room.level===0;
}
export function defaultRoomLayout(home,room,catalog){
 if(SHOWROOMS[room.defaultTemplate?.kind]){
  const source={id:uid(),name:room.name,x:0,z:0,level:0,wall:room.wall,items:[]};
  furnishShowroom(source,room.defaultTemplate.kind,catalog,{compact:room.defaultTemplate.compact});
  return source;
 }
 if(ROOM_PALETTES[home.homePalette]){
  const index=STARTER_ROOMS.findIndex(spec=>spec.x===room.x&&spec.level===room.level&&room.z===0);
  if(index>=0)return createStarterHome(catalog,home.homePalette).rooms[index];
 }
 if(room.x===0&&room.z===0&&room.level===0)return clone(createHome(catalog).rooms[0]);
 return null;
}
