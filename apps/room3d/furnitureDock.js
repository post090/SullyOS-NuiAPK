// Preserve the calibrated seat distance when the whole computer desk is scaled.
export const computerSeatOffset=a=>Math.max(1.04*a.size[0]/3.4,a.boxes[0][5]+.28);
// A chair is linked to a table, independently of tabletop support. No scene
// objects or animation state are stored in the layout.
export const isDockChair=a=>a?.surface==='floor'&&(a.id==='chair'||a.seats?.length===1);
export const isDockTable=a=>!!a?.chairSlots||['table','daisy_table','worktable','gaming_desk'].includes(a?.id);
export function furnitureGroup(room,id){
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const i of room.items)if(!ids.has(i.id)&&(ids.has(i.supportId)||ids.has(i.dockId))){ids.add(i.id);changed=true;}}
 return room.items.filter(i=>ids.has(i.id));
}
export function dockSlots(table,chair,room,catalog){
 const a=catalog.find(a=>a.id===table.assetId),c=catalog.find(a=>a.id===chair.assetId);
 if(!isDockTable(a)||!isDockChair(c))return [];
 let slots=a.chairSlots;
 if(!slots&&a.id==='gaming_desk'&&c.id==='gaming_chair'){
  const seat=c.seats[0].position,k=room.items.find(i=>!i.stored&&i.supportId===table.id&&i.assetId==='gaming_keyboard'),t=table.rotation*Math.PI/180;
  const x=k?Math.cos(t)*(k.x-table.x)-Math.sin(t)*(k.z-table.z):0;
  slots=[{id:'front',position:[x+seat[0],0,computerSeatOffset(a)+seat[2]],rotation:180}];
 }
 if(!slots){
  const z=a.size[2]/2+c.size[2]/2+.10,x=a.size[0]/2+c.size[2]/2+.10;
  slots=[{id:'front',position:[0,0,z],rotation:180}];
  if(['table','daisy_table'].includes(a.id))slots.push({id:'back',position:[0,0,-z],rotation:0},{id:'left',position:[-x,0,0],rotation:90},{id:'right',position:[x,0,0],rotation:270});
 }
 const t=table.rotation*Math.PI/180,cos=Math.cos(t),sin=Math.sin(t);
 return slots.map(s=>({...chair,x:table.x+cos*s.position[0]+sin*s.position[2],y:table.y+s.position[1],z:table.z-sin*s.position[0]+cos*s.position[2],rotation:(table.rotation+s.rotation)%360,dockId:table.id,dockSlot:s.id}));
}
export function dockCandidates(chair,room,catalog,radius=.65){
 if(chair.dockDisabled||!isDockChair(catalog.find(a=>a.id===chair.assetId)))return [];
 return room.items.filter(t=>!t.stored&&t.id!==chair.id&&isDockTable(catalog.find(a=>a.id===t.assetId))).flatMap(t=>dockSlots(t,chair,room,catalog))
  .filter(p=>Math.hypot(p.x-chair.x,p.z-chair.z)<=radius&&!room.items.some(i=>!i.stored&&i.id!==chair.id&&i.dockId===p.dockId&&i.dockSlot===p.dockSlot))
  .sort((a,b)=>Math.hypot(a.x-chair.x,a.z-chair.z)-Math.hypot(b.x-chair.x,b.z-chair.z));
}
