import {ROOM_HALF} from './dimensions.js';
import {boxes} from './model.js';
import {ROOM_EDGES} from './building.js';
import {boundary,boundaryBoxes,ROOM_STEP,neighbor,insideFloors} from './topology.js';
export function walkingMap(home,level,catalog,{headWidth=1.5,headBottom=.7,headTop=1.95,walkClearance=false}={}){
 const cells=[],areas=[],obstacles=[];const half=Math.max(.75,headWidth/2);
 // Hair/accessories may overlap: walking uses the core silhouette, not the full head bounds.
 const headRadius=walkClearance ? .34 : Math.max(.58,half*.85);
 for(const room of home.rooms.filter(r=>r.level===level)){
  const start=cells.length,x=room.x*ROOM_STEP.x,z=room.z*ROOM_STEP.z;cells.push([x-ROOM_HALF.x,z-ROOM_HALF.z,x+ROOM_HALF.x,z+ROOM_HALF.z]);
  for(const [edge,e] of Object.entries(ROOM_EDGES)){const door=boundary(room,edge).door;if(!door||neighbor(home,room,edge))continue;
   const lo=door.at-door.width/2-.35,hi=door.at+door.width/2+.35,at=e.at,sign=Math.sign(at),a=at-sign*.3,b=at+sign*2.2;
   cells.push(e.axis==='z'?[x+lo,z+Math.min(a,b),x+hi,z+Math.max(a,b)]:[x+Math.min(a,b),z+lo,x+Math.max(a,b),z+hi]);
  }
  areas.push(...cells.slice(start).map(rect=>({roomId:room.id,rect})));
  const local=[...boundaryBoxes(room,catalog),...room.items.filter(i=>!i.stored&&!catalog.find(a=>a.id===i.assetId)?.building&&!['rug','ceiling'].includes(catalog.find(a=>a.id===i.assetId)?.surface)).flatMap(i=>boxes(i,catalog.find(a=>a.id===i.assetId)))];
  obstacles.push(...local.map(b=>[b[0]+x,b[1],b[2]+z,b[3]+x,b[4],b[5]+z]));
  // Freestanding walls are obstacles too (edge segments already included above).
  for(const i of room.items.filter(i=>!i.stored&&catalog.find(a=>a.id===i.assetId)?.building))obstacles.push(...boxes(i,catalog.find(a=>a.id===i.assetId)).map(b=>[b[0]+x,b[1],b[2]+z,b[3]+x,b[4],b[5]+z]));
 }
 const free=(x,z)=>{
  // Walking tolerates hair overhang and uses a round head rather than reserving
  // the empty corners of a square. Stationary placement checks retain full clearance.
  const floorHalf=walkClearance ? .28 : half;
  if(!insideFloors([x-floorHalf,z-floorHalf,x+floorHalf,z+floorHalf],cells))return false;
  const body=[x-.28,.18,z-.28,x+.28,headBottom,z+.28],head=[x-half,headBottom,z-half,x+half,headTop,z+half];
  if(walkClearance)return !obstacles.some(b=>{
   const bodyHit=body[0]<b[3]&&body[3]>b[0]&&body[1]<b[4]&&body[4]>b[1]&&body[2]<b[5]&&body[5]>b[2];
   const dx=Math.max(b[0]-x,0,x-b[3]),dz=Math.max(b[2]-z,0,z-b[5]);
   return bodyHit||headBottom<b[4]&&headTop>b[1]&&dx*dx+dz*dz<headRadius*headRadius;
  });
  return !obstacles.some(b=>[body,head].some(a=>a[0]<b[3]&&a[3]>b[0]&&a[1]<b[4]&&a[4]>b[1]&&a[2]<b[5]&&a[5]>b[2]));
 };
 return {free,cells,obstacles,areas};
}
export function findWalkPath(map,start,target,{targetRadius=0}={}){
 // Only a direct ground click can snap. Furniture/door contact targets remain
 // exact, and a valid but disconnected destination must never jump a wall.
 if(targetRadius>0&&!map.free(...target)&&map.free(...start)){
  const candidates=[];
  for(let radius=.15;radius<=Math.min(targetRadius,.6)+.001;radius+=.15)for(let i=0;i<16;i++){
   const angle=i*Math.PI/8,p=[target[0]+Math.cos(angle)*radius,target[1]+Math.sin(angle)*radius];
   if(map.free(...p))candidates.push(p);
  }
  for(const p of candidates.slice(0,8)){const path=findWalkPath(map,start,p);if(path)return path;}
  return null;
 }
 const step=.2,key=(x,z)=>x+','+z,point=([x,z])=>[x*step,z*step];
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.07));for(let i=0;i<=n;i++)if(!map.free(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;};
 if(!map.free(...start)||!map.free(...target))return null;
 if(clear(start,target))return [start,target];
 // A valid exact endpoint can round into furniture. Attach it to each nearby
 // reachable grid node instead of rejecting the route at that rounding step.
 const attachments=p=>{
  const center=p.map(v=>Math.round(v/step)),result=[];
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
   const node=[center[0]+dx,center[1]+dz];if(clear(p,point(node)))result.push(node);
  }
  return result.sort((a,b)=>Math.hypot(a[0]*step-p[0],a[1]*step-p[1])-Math.hypot(b[0]*step-p[0],b[1]*step-p[1]));
 };
 const sources=attachments(start),goals=new Set(attachments(target).map(p=>key(...p)));
 if(!sources.length||!goals.size)return null;
 const queue=[...sources],parents=new Map(sources.map(p=>[key(...p),null]));let end=null;
 for(let n=0;n<queue.length&&n<40000;n++){
  const p=queue[n];if(goals.has(key(...p))){end=p;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const next=[p[0]+dx,p[1]+dz],id=key(...next);if(parents.has(id)||!map.free(...point(next)))continue;
   if(dx&&dz&&(!map.free(...point([p[0]+dx,p[1]]))||!map.free(...point([p[0],p[1]+dz]))))continue;
   parents.set(id,p);queue.push(next);
  }
 }
 if(!end)return null;const path=[target];for(let p=end;p;p=parents.get(key(...p)))path.push(point(p));path.push(start);path.reverse();
 // Remove grid zigzags without cutting corners; do not overshoot the destination
 // and turn backwards for the final few centimetres.
 const smooth=[start];for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!clear(path[i],path[j]))j--;smooth.push(path[j]);i=j;}return smooth;
}
export function doorTarget(home,room,edge,outside=false){
 const e=ROOM_EDGES[edge],d=boundary(room,edge).door;if(!d)return null;
 const sign=Math.sign(e.at),normal=e.at+sign*(outside?-1:1)*1.05;
 return e.axis==='z'?[room.x*ROOM_STEP.x+d.at,room.z*ROOM_STEP.z+normal]:[room.x*ROOM_STEP.x+normal,room.z*ROOM_STEP.z+d.at];
}
