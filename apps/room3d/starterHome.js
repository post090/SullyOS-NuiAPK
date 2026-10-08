import {createHome,uid} from './model.js';
import {furnishShowroom} from './showrooms.js';
import {bathroomHome} from './bathroomLayout.js';
import {applyRoomPalette,ROOM_PALETTES} from './roomPalettes.js';

// Integer navigation cells; homeDisplayX centers the 3/2/1 floors in map and overview.
export const STARTER_ROOMS=[
 {name:'客厅',x:0,level:0,kind:'living'},
 {name:'卫生间',x:1,level:0,kind:'bathroom'},
 {name:'厨房',x:2,level:0,kind:'kitchen'},
 {name:'卧室',x:1,level:1,kind:'bedroom'},
 {name:'书房',x:2,level:1,kind:'study'},
 {name:'空房',x:2,level:2,kind:null},
];
export function createStarterHome(catalog,palette='sage'){
 if(!ROOM_PALETTES[palette])throw Error('请选择房屋配色');
 const home=createHome(catalog);
 home.rooms=STARTER_ROOMS.map(spec=>{
  let room={id:uid(),name:spec.name,x:spec.x,z:0,level:spec.level,wall:'#f0e6d5',items:[]};
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
