// A held plush is a temporary presentation of one placed furniture instance.
// Its saved position/support remain the return location; never duplicate inventory.
export function roomPlush(room,catalog){return room.items.filter(i=>!i.stored&&catalog.find(a=>a.id===i.assetId)?.holdable).map(i=>({itemId:i.id,label:catalog.find(a=>a.id===i.assetId).name}));}
export function plushPose(asset,time=0){
 const s=asset.size,scale=Math.min(.78/s[0],.64/s[1],.76/s[2]);
 const width=s[0]*scale,height=s[1]*scale,depth=s[2]*scale,bob=Math.sin(time*1.8)*.008;
 // Preserve the silhouette uniformly; hold it below the eyes, clear of the torso.
 const base=.27,bottom=base+bob,z=.39+depth/2;
 return {scale,position:[0,bottom,z],hands:[[-width*.46/.7,(base+height*.46+bob)/.7,(z+depth*.12)/.7],[width*.46/.7,(base+height*.46+bob)/.7,(z+depth*.12)/.7]]};
}

export function body2PlushPose(asset,time,chestHeight){
 const pose=plushPose(asset,time),lift=chestHeight-.45-pose.position[1];
 pose.position[1]+=lift;pose.position[2]-=.16;
 for(const hand of pose.hands){hand[1]+=lift/.7;hand[2]-=.16/.7;}
 return pose;
}
