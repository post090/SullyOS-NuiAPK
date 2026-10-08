import {boxes} from './model.js';
import {findWalkPath} from './navigation.js';

export const petBedtime=hour=>hour>=22||hour<8;
// Reviewed low mattress surfaces; raised bunks/lofts have no safe pet entry yet.
const beds={show_bed:{y:.85,x:1.30,z:1.05},bedroom_single_bed:{y:1.10,x:.82,z:1.05},bedroom_double_bed:{y:1.08,x:1.48,z:1.05}};
export function petSleepCandidates(room,catalog,pet,map,people,reserved){
 const result=[],radius=map.radius,asset=catalog.find(a=>a.id===pet.assetId),height=asset.size[1]*.75;
 for(const item of room.items.filter(i=>!i.stored&&!reserved.has(i.id))){
  const a=catalog.find(a=>a.id===item.assetId),bed=beds[a?.id],nest=a?.petInteraction==='sleep';if(!nest&&!bed)continue;
  const yaw=item.rotation*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw),world=(x,y,z)=>[item.x+c*x+s*z,item.y+y,item.z-s*x+c*z];
  const spots=nest?[[0,a.size[1],0]]:[[-Math.max(0,bed.x-radius),bed.y,bed.z],[Math.max(0,bed.x-radius),bed.y,bed.z]];
  for(const spot of spots){
   const target=world(...spot);
   if(people.some(p=>Math.hypot(p.x-target[0],p.z-target[2])<radius+.48))continue;
   // Ignore only the supporting bed/mat, never neighboring furniture or walls.
   if(room.items.some(i=>!i.stored&&i.id!==item.id&&boxes(i,catalog.find(a=>a.id===i.assetId)).some(b=>target[1]+height>b[1]&&target[1]<b[4]&&target[0]+radius>b[0]&&target[0]-radius<b[3]&&target[2]+radius>b[2]&&target[2]-radius<b[5])))continue;
   const approaches=nest?[[target[0],target[2]]]:[[-1,0],[1,0],[0,1]].map(([x,z])=>{const p=world(x?(a.size[0]/2+radius+.12)*x:spot[0],0,z?(a.size[2]/2+radius+.12)*z:spot[2]);return [p[0],p[2]];});
   for(const entry of approaches){
    if(Math.hypot(target[0]-entry[0],target[2]-entry[1])>1.65)continue;
    const path=findWalkPath(map,[pet.x,pet.z],entry);if(!path)continue;
    result.push({kind:'sleep',itemId:item.id,path,sleepSpot:target,nest,distance:path.reduce((n,p,i)=>n+(i?Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1]):0),0)});break;
   }
  }
 }
 return result.sort((a,b)=>Number(b.nest)-Number(a.nest)||a.distance-b.distance);
}
export function petSleepPose(p,r){
 if(!r?.sleepSpot||r.path.length)return [p.x,.18,p.z];
 const t=Math.min(1,(r.sleepTime||0)/.8),w=r.sleepStage==='down'?1-t:r.sleepStage==='sleep'?1:t;
 return [p.x+(r.sleepSpot[0]-p.x)*w,.18+(r.sleepSpot[1]-.18)*w+(r.sleepStage==='sleep'?0:Math.sin(Math.PI*t)*.4),p.z+(r.sleepSpot[2]-p.z)*w];
}
