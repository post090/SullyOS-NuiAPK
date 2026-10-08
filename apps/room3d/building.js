import {ROOM_HALF,ROOM_SCALE} from './dimensions.js';
// Building segments share the furniture editor's placement and history system.
export const BUILDING_LENGTH=1.2;
export const BUILDING_ASSETS=[
 ['wall_high','高墙',4.65],['wall_low','矮墙',.94],['wall_fence','栅栏',.94],
].map(([id,name,height])=>({id,name,building:true,surface:'floor',size:[BUILDING_LENGTH,height,.24],default:[0,.15,-.8],boxes:[[-.6,0,-.12,.6,height,.12]]}));
export const buildingScale=item=>(item.length??BUILDING_LENGTH)/BUILDING_LENGTH;
export const ROOM_EDGES={front:{axis:'z',at:ROOM_HALF.z,half:ROOM_HALF.x,rotation:0},back:{axis:'z',at:-ROOM_HALF.z,half:ROOM_HALF.x,rotation:0},left:{axis:'x',at:-ROOM_HALF.x,half:ROOM_HALF.z,rotation:90},right:{axis:'x',at:ROOM_HALF.x,half:ROOM_HALF.z,rotation:90}};
export function buildingEdge(item){
 return Object.keys(ROOM_EDGES).find(key=>{const e=ROOM_EDGES[key];return item.rotation%180===e.rotation&&Math.abs(item[e.axis]-e.at)<.001;});
}
export function placeBuildingOnEdge(item,key){
 const edge=ROOM_EDGES[key];if(!edge)return item;
 const along=edge.axis==='x'?'z':'x',limit=Math.max(0,edge.half-(item.length??BUILDING_LENGTH)/2);
 return {...item,[edge.axis]:edge.at,[along]:Math.max(-limit,Math.min(limit,item[along])),rotation:edge.rotation,y:.15};
}
export function snapBuildingToEdge(item){
 const closest=Object.keys(ROOM_EDGES).sort((a,b)=>Math.abs(item[ROOM_EDGES[a].axis]-ROOM_EDGES[a].at)-Math.abs(item[ROOM_EDGES[b].axis]-ROOM_EDGES[b].at))[0];
 const edge=ROOM_EDGES[closest];
 return Math.abs(item[edge.axis]-edge.at)<.42?placeBuildingOnEdge(item,closest):item;
}
// Replace only the occupied interval of an existing exterior wall.
export function exteriorWallRemainders(items,catalog){
 const original={back:[[-ROOM_HALF.x,ROOM_HALF.x]],left:[[-ROOM_HALF.z,ROOM_HALF.z]],right:[[-ROOM_HALF.z,-1.82*ROOM_SCALE]],front:[]},result={};
 for(const item of items){
  if(item.stored||!catalog.find(a=>a.id===item.assetId)?.building)continue;
  const key=buildingEdge(item);if(!key)continue;
  const along=ROOM_EDGES[key].axis==='x'?'z':'x',half=(item.length??BUILDING_LENGTH)/2,start=item[along]-half,end=item[along]+half;
  result[key]=(result[key]??original[key]).flatMap(([a,b])=>end<=a||start>=b?[[a,b]]:[[a,Math.min(b,start)],[Math.max(a,end),b]].filter(([x,y])=>y-x>.001));
 }
 return result;
}
