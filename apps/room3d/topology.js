import {ROOM_EDGES,buildingEdge,BUILDING_LENGTH} from './building.js';
export {ROOM_STEP} from './dimensions.js';
import {ROOM_STEP} from './dimensions.js';
export const OPPOSITE={left:'right',right:'left',front:'back',back:'front'};
export const EDGE_NAMES={back:'后侧',left:'左侧',right:'右侧',front:'前侧'};
export const WALL_VIEWS={cutaway:'默认',dollhouse:'娃娃屋',hidden:'无墙'};
export const DOOR_KINDS={door:'平开门',arch:'拱门',sliding:'推拉门',ribbon:'蝴蝶结心窗门',oak:'浅木镶板门',walnut:'深木镶板门',lattice:'木格推拉门'};
export const MIN_DOOR_WIDTH=1.8;
export function neighbor(home,room,edge){const e=ROOM_EDGES[edge];return home.rooms.find(r=>r.level===room.level&&r.x===room.x+(e.axis==='x'?Math.sign(e.at):0)&&r.z===room.z+(e.axis==='z'?Math.sign(e.at):0));}
export function roomOffset(room,anchor){return [(room.x-anchor.x)*ROOM_STEP.x,(room.z-anchor.z)*ROOM_STEP.z];}
export function boundary(room,edge){return room.boundaries?.[edge]??{kind:'wall_high'};}
export function subtractIntervals(intervals,lo,hi){return intervals.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([x,y])=>y-x>.001));}
// Keep collision, rendering and enclosure detection on the same physical edges.
export function roomBoundarySegments(room,edge,catalog){
 const e=ROOM_EDGES[edge],base=boundary(room,edge),along=e.axis==='x'?'z':'x';
 let result=base.kind==='open'?[]:[{lo:-e.half,hi:e.half,kind:base.kind}];
 for(const item of room.items){if(item.stored||!catalog.find(a=>a.id===item.assetId)?.building||buildingEdge(item)!==edge)continue;
  const half=(item.length??BUILDING_LENGTH)/2,lo=Math.max(-e.half,item[along]-half),hi=Math.min(e.half,item[along]+half);
  result=result.flatMap(s=>subtractIntervals([[s.lo,s.hi]],lo,hi).map(([a,b])=>({...s,lo:a,hi:b})));
  result.push({lo,hi,kind:item.assetId,itemId:item.id});
 }
 if(base.door){const {at,width}=base.door;result=result.flatMap(s=>subtractIntervals([[s.lo,s.hi]],at-width/2,at+width/2).map(([lo,hi])=>({...s,lo,hi})));}
 return result.filter(s=>s.hi>s.lo);
}
export function edgeGaps(room,edge,catalog,includeDoors=true){
 let gaps=[[-ROOM_EDGES[edge].half,ROOM_EDGES[edge].half]];
 for(const s of roomBoundarySegments(room,edge,catalog))gaps=subtractIntervals(gaps,s.lo,s.hi);
 const door=boundary(room,edge).door;if(door&&!includeDoors)gaps=subtractIntervals(gaps,door.at-door.width/2,door.at+door.width/2);
 return gaps;
}
export function sharedGaps(home,room,edge,catalog,includeDoors=true){
 const other=neighbor(home,room,edge),gaps=edgeGaps(room,edge,catalog,includeDoors);if(!other)return gaps;
 return gaps.flatMap(([a,b])=>edgeGaps(other,OPPOSITE[edge],catalog,includeDoors).map(([c,d])=>[Math.max(a,c),Math.min(b,d)]).filter(([lo,hi])=>hi-lo>.001));
}
export function connectedRooms(home,startId,catalog,throughDoors=false){
 const found=new Set([startId]),queue=[home.rooms.find(r=>r.id===startId)];
 for(let i=0;i<queue.length;i++)for(const edge of Object.keys(ROOM_EDGES)){
  const room=queue[i],other=neighbor(home,room,edge);if(!other||found.has(other.id))continue;
  if(sharedGaps(home,room,edge,catalog,false).length||throughDoors&&sharedGaps(home,room,edge,catalog,true).some(([a,b])=>b-a>MIN_DOOR_WIDTH-.01)){found.add(other.id);queue.push(other);}
 }
 return queue;
}
export function roomGroups(home,catalog){const seen=new Set(),groups=[];for(const r of home.rooms)if(!seen.has(r.id)){const rooms=connectedRooms(home,r.id,catalog);rooms.forEach(r=>seen.add(r.id));groups.push(rooms);}return groups;}
export function wallVisible(view,edge,internal=false){return view!=='hidden'&&(view==='auto'||view!=='flat'&&internal||edge==='back'||edge==='left'||view==='dollhouse'&&edge==='right');}
export function setBoundary(home,roomId,edge,value,catalog){
 const room=home.rooms.find(r=>r.id===roomId),e=ROOM_EDGES[edge];if(!room||!e)throw Error('找不到这面墙');
 if(!['wall_high','wall_low','wall_fence','open'].includes(value.kind))throw Error('墙体类型不正确');
 if(value.door){const d=value.door;if(!DOOR_KINDS[d.kind]||!Number.isFinite(d.width)||d.width<MIN_DOOR_WIDTH||d.width>e.half*2-.4||!Number.isFinite(d.at)||Math.abs(d.at)+d.width/2>e.half-.2)throw Error('门洞需要至少 1.8 格宽，并完整留在墙内');if(value.kind==='open')throw Error('先立墙，再安装门');}
 const other=neighbor(home,room,edge);
 for(const [r,key] of [[room,edge],...(other?[[other,OPPOSITE[edge]]]:[])]){
  r.boundaries={...r.boundaries,[key]:structuredClone(value)};
  // A complete edge edit replaces loose segments on both sides of the partition.
  for(const item of r.items)if(!item.stored&&catalog.find(a=>a.id===item.assetId)?.building&&buildingEdge(item)===key)item.stored=true;
 }
}
export function validateBoundaries(home){
 for(const r of home.rooms){if(r.boundaries==null)continue;if(typeof r.boundaries!=='object'||Array.isArray(r.boundaries))throw Error('墙体数据不正确');
  for(const [edge,v] of Object.entries(r.boundaries)){const e=ROOM_EDGES[edge];if(!e||!v||!['wall_high','wall_low','wall_fence','open'].includes(v.kind))throw Error('墙体数据不正确');
   if(v.door){const d=v.door;if(v.kind==='open'||!DOOR_KINDS[d.kind]||!Number.isFinite(d.width)||d.width<MIN_DOOR_WIDTH||d.width>e.half*2-.4||!Number.isFinite(d.at)||Math.abs(d.at)+d.width/2>e.half-.2)throw Error('门洞尺寸不正确');}
   const n=neighbor(home,r,edge),other=n&&boundary(n,OPPOSITE[edge]);if(other&&(v.kind!==other.kind||v.door?.kind!==other.door?.kind||v.door?.at!==other.door?.at||v.door?.width!==other.door?.width))throw Error('相邻房间的隔墙数据不一致');
  }
 }
}
export function boundaryBoxes(room,catalog){
 const result=[];
 for(const [edge,e] of Object.entries(ROOM_EDGES)){
  for(const s of roomBoundarySegments(room,edge,catalog)){const h=s.kind==='wall_high'?4.65:.94;result.push(e.axis==='z'?[s.lo,.15,e.at-.12,s.hi,.15+h,e.at+.12]:[e.at-.12,.15,s.lo,e.at+.12,.15+h,s.hi]);}
  const d=boundary(room,edge).door;if(d){const lo=d.at-d.width/2,hi=d.at+d.width/2,top=boundary(room,edge).kind==='wall_high'?4.8:2.65;result.push(e.axis==='z'?[lo,2.35,e.at-.12,hi,top,e.at+.12]:[e.at-.12,2.35,lo,e.at+.12,top,hi]);}
 }
 return result;
}

// Exact rectangular union containment, including furniture straddling an open seam.
export function insideFloors(rect,cells){
 const xs=[rect[0],rect[2],...cells.flatMap(c=>[c[0],c[2]]).filter(x=>x>rect[0]&&x<rect[2])].sort((a,b)=>a-b);
 const zs=[rect[1],rect[3],...cells.flatMap(c=>[c[1],c[3]]).filter(z=>z>rect[1]&&z<rect[3])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;if(!cells.some(c=>x>=c[0]-.001&&x<=c[2]+.001&&z>=c[1]-.001&&z<=c[3]+.001))return false;}
 return true;
}

// Visibility is independent of whether walls/doors permit movement.
export function displayRooms(home,anchor,scope='floor'){return scope==='room'?[anchor]:home.rooms.filter(r=>r.level===anchor.level).sort((a,b)=>Math.abs(a.x-anchor.x)+Math.abs(a.z-anchor.z)-Math.abs(b.x-anchor.x)-Math.abs(b.z-anchor.z)||a.id.localeCompare(b.id));}
