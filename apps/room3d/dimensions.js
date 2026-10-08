// Room footprint only: furniture, residents, wall height and floor thickness
// retain their authored sizes. Versioned separately from furniture assets.
export const ROOM_SCALE=1.5;
export const ROOM_SIZE_VERSION=2;
export const ROOM_HALF={x:4.65,z:3.975};
export const ROOM_STEP={x:9.3,z:7.95};
export const MAX_BUILDING_LENGTH=10;

export function migrateRoomSize(home,catalog){
 if(home.roomSizeVersion===ROOM_SIZE_VERSION)return;
 for(const room of home.rooms){
  for(const side of Object.values(room.boundaries||{}))if(side.door)side.door.at*=ROOM_SCALE;
  for(const item of room.items){
   const asset=catalog.find(a=>a.id===item.assetId);if(!asset)continue;
   // Keep furniture arrangements and their interaction distances intact. Only
   // perimeter attachments follow the expanded shell; tabletop children stay put.
   if(asset.building){
    const axis=item.rotation%180===0?'z':'x',along=axis==='z'?'x':'z',old=axis==='z'?2.65:3.1;
    if(Math.abs(Math.abs(item[axis])-old)<.001){item[axis]*=ROOM_SCALE;item[along]*=ROOM_SCALE;item.length=(item.length??1.2)*ROOM_SCALE;}
   }else if(['wall','back','left'].includes(asset.surface)){
    const axis=asset.surface==='back'?'z':asset.surface==='left'?'x':item.rotation%180===0?'z':'x',old=axis==='z'?2.65:3.1;
    const exterior=asset.surface!=='wall'||Math.abs(Math.abs(item[axis])-(old-.12-asset.size[2]/2-.012))<.035;
    if(exterior){item[axis]+=Math.sign(item[axis])*old*(ROOM_SCALE-1);item[axis==='z'?'x':'z']*=ROOM_SCALE;}
   }
  }
 }
 home.roomSizeVersion=ROOM_SIZE_VERSION;
}
