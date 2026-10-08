import {furnitureActivitySeconds} from './furnitureActivityLifetime';
import {gamingPoint,clearance} from './gaming.js';
export const BATH_ACTIONS={bath_shower:{kind:'bath-shower',label:'洗澡',point:[0,.05,.08],rotation:0},bath_tub:{kind:'bath-soak',label:'泡泡浴',point:[.3,.54,.08],rotation:0,posture:'seated'},bath_washer:{kind:'bath-laundry',label:'洗衣',point:[0,.03,1.45],rotation:180},bath_toilet:{kind:'bath-toilet',label:'坐',point:[0,.79,.25],rotation:0,posture:'seated'}};
export const isBathAction=kind=>kind?.startsWith('bath-');
export function bathroomActivities(room,catalog,{headWidth=1.5,body2=false}={}){
 return room.items.filter(i=>!i.stored&&BATH_ACTIONS[i.assetId]).map(item=>{
  const spec={...BATH_ACTIONS[item.assetId]};
  if(body2&&spec.kind==='bath-soak'){spec.point=[.65,.54,.02];spec.rotation=-90;}
  if(body2&&spec.kind==='bath-laundry')spec.point=[0,.03,1.18];
  const position=gamingPoint(item,spec.point),rotation=(item.rotation+spec.rotation)*Math.PI/180;
  const pose={position,rotation};
  // Reviewed bathing interiors intentionally contain the resident; still check
  // walls, all other furniture, and the full head footprint.
  const exclude=spec.kind==='bath-laundry'?[]:[item.id,...room.items.filter(i=>i.supportId===item.id||room.items.some(p=>p.id===i.supportId&&p.supportId===item.id)).map(i=>i.id)];
  const contact=spec.kind==='bath-soak'?[[.65,1.16,-.52],[.65,1.16,.52]]:spec.kind==='bath-laundry'?[[.40,1.30,.56]]:[];
  const bathHands=contact.map(p=>{const v=gamingPoint(item,p),dx=v[0]-position[0],dz=v[2]-position[2],c=Math.cos(rotation),s=Math.sin(rotation);return [c*dx-s*dz,v[1]-position[1],s*dx+c*dz];});
  return {...spec,...pose,body2,bathHands,edge:gamingPoint(item,[.65,1.17,.65]),edgeRotation:item.rotation*Math.PI/180,roomId:item.ownerRoomId||room.id,itemId:item.id,seat:null,dependencies:[],hands:[[-.30,.55,.2],[.30,.55,.2]],reason:clearance(room,catalog,pose,exclude,headWidth),duration:furnitureActivitySeconds(spec.kind)};
 });
}
