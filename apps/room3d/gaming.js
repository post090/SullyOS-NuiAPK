import {computerSeatOffset} from './furnitureDock.js';
import {ROOM_HALF} from './dimensions.js';
import {boxes,placementError,snapToSupport,uid} from './model.js';
import {seatTransform,roomSeats} from './seating.js';
import {boundaryBoxes,insideFloors} from './topology.js';
export const GAMING_ACTIONS={computer:'玩电脑',stream:'开直播',race:'玩赛车',rhythm:'玩圆环音游'};
const asset=(catalog,id)=>catalog.find(a=>a.id===id);
export function gamingPoint(item,p){const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [item.x+c*p[0]+s*p[2],item.y+p[1],item.z-s*p[0]+c*p[2]];}
const overlap=(a,b)=>a[0]<b[3]-.015&&a[3]>b[0]+.015&&a[1]<b[4]-.015&&a[4]>b[1]+.015&&a[2]<b[5]-.015&&a[5]>b[2]+.015;
export function clearance(room,catalog,pose,excluded,headWidth,profile={}){
 const [x,y,z]=pose.position,a=pose.rotation,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a)),hx=c*headWidth/2+s*.43,hz=s*headWidth/2+c*.43;
 const rect=[x-hx,z-hz,x+hx,z+hz];if(room.floorCells?!insideFloors(rect,room.floorCells):rect[0]<-ROOM_HALF.x+.14||rect[2]>ROOM_HALF.x-.14||rect[1]<-ROOM_HALF.z+.15||rect[3]>ROOM_HALF.z-.15)return '给脑袋留一点空间，离墙远些';
 const bottom=profile.headBottom??y+.60,top=profile.headTop??y+1.62;
 const volumes=[[x-.25,y+.025,z-(profile.bodyHalfDepth??.25),x+.25,profile.headBottom??y+.53,z+(profile.bodyHalfDepth??.25)],[x-hx,bottom,z-hz,x+hx,top,z+hz]];
 const obstacles=[...boundaryBoxes(room,catalog),...room.items.filter(i=>!i.stored&&!excluded.includes(i.id)&&!(pose.kind==='rhythm'?['rug']:['rug','ceiling']).includes(asset(catalog,i.assetId)?.surface)).flatMap(i=>boxes(i,asset(catalog,i.assetId)))];
 if(obstacles.some(b=>volumes.some(v=>overlap(v,b))))return '座位或头部空间被挡住了';
 return '';
}
export function gamingActivities(room,catalog,{headWidth=1.5,body2=false,shoulderHeight=1.652,armReach=.678}={}){
 const results=[];
 for(const item of room.items.filter(i=>!i.stored)){
  const a=asset(catalog,item.assetId);let specs=[];
  if(item.assetId==='gaming_desk'){
   const props=room.items.filter(i=>!i.stored&&i.supportId===item.id),find=id=>props.find(i=>i.assetId===id),keyboard=find('gaming_keyboard'),screen=find('gaming_monitors'),mic=find('gaming_microphone'),camera=find('gaming_webcam');
   for(const kind of ['computer','stream']){
    const local=keyboard?inversePoint(item,[keyboard.x,keyboard.y,keyboard.z]):[0,0,.38];
    const p=gamingPoint(item,[local[0],0,computerSeatOffset(a)]);
    const hands=keyboard?[gamingPoint(keyboard,[-.22,.035,.23]),gamingPoint(keyboard,[.22,.035,.23])]:[];
    const mouse=find('gaming_mouse');
    specs.push({kind,mouseHand:mouse?gamingPoint(mouse,[0,.06,0]):undefined,position:p,rotation:(item.rotation+180)*Math.PI/180,hands,needsChair:true,missing:kind==='computer'?!keyboard||!screen:!keyboard||!mic||!camera,dependencies:props.filter(p=>[keyboard?.id,screen?.id,mic?.id,camera?.id].includes(p.id)).map(p=>p.id)});
   }
  }else if(a?.activity){const d=a.activity;specs=(d.stations||[d]).map(st=>({kind:d.kind,stationId:st.id,label:st.label,position:gamingPoint(item,st.position),rotation:(item.rotation+st.rotation)*Math.PI/180,hands:st.hands.map(p=>gamingPoint(item,p)),beats:st.beats?.map(b=>({...b,position:gamingPoint(item,b.position),targets:b.targets.map(p=>gamingPoint(item,p))})),needsChair:d.kind==='race',dependencies:[]}));}
  for(const spec of specs){let reason=spec.missing?(spec.kind==='stream'?'桌上需要键盘、麦克风和摄像头':'桌上需要键盘和显示器'):'',seat=null;
   if(spec.needsChair){const candidates=roomSeats(room,catalog).filter(s=>asset(catalog,room.items.find(i=>i.id===s.itemId)?.assetId)?.id==='gaming_chair').map(s=>({s,t:seatTransform(room,catalog,s)}));
    const match=candidates.find(({t})=>Math.hypot(t.position[0]-spec.position[0],t.position[2]-spec.position[2])<.18&&Math.cos(t.rotation-spec.rotation)>.98);
    if(match){seat=match.s;spec.position=match.t.position;spec.rotation=match.t.rotation;}else reason||='需要把电脑椅朝向设备摆好';
   }
   // The taller rig plays from one standing spot, slightly nearer the panel.
   if(body2&&spec.kind==='rhythm'){const closer=.18+Math.max(0,shoulderHeight-1.65)*.30;spec.position[0]+=Math.sin(spec.rotation)*closer;spec.position[2]+=Math.cos(spec.rotation)*closer;}
   if(!reason)reason=clearance(room,catalog,spec,seat?[seat.itemId]:[],headWidth,body2&&spec.kind==='rhythm'?{bodyHalfDepth:.20,headBottom:spec.position[1]+shoulderHeight+.10,headTop:spec.position[1]+shoulderHeight+1}:{});
   const hands=spec.hands.map(p=>inversePose(spec,p)).sort((a,b)=>a[0]-b[0]);
   if(!reason&&!spec.beats&&hands.some(p=>Math.abs(p[0])>.72||p[1]<.16||p[1]>.85||p[2]<.05||p[2]>.83))reason='把键盘或座椅靠近一点，让小手够得到';
   const rhythm=spec.beats?.map(b=>{
    const offset=inversePose(spec,b.position),apex={...spec,position:b.position},targets=b.targets.map(p=>inversePose(apex,p));
    const beatHands=[[-.415,.51,.10],[.415,.51,.10]];
    targets.forEach(p=>{beatHands[p[0]<-.001?0:1]=p;});
    if(!reason&&targets.some(p=>Math.abs(p[0])>.80||p[1]<.16||p[1]>.90||p[2]<.05||p[2]>.83))reason='按钮太远了，小手够不到';
    // Check the entire upward/forward trajectory, not just the standing spot.
    if(!reason&&!body2)for(const f of [.25,.5,.75,1]){const position=spec.position.map((v,k)=>v+(b.position[k]-v)*f);const blocked=clearance(room,catalog,{...spec,position},[],headWidth);if(blocked){reason='跳起来的空间被挡住了，给机台前方留空';break;}}
    return {offset,hands:beatHands,keys:b.keys};
   });
   let rhythmStanding,wheel;
   if(body2&&spec.beats){
    const points=[...new Map(spec.beats.flatMap(b=>b.targets.map((p,i)=>[b.keys[i],inversePose(spec,p)]))).entries()];
    const center=points.reduce((c,[,p])=>c.map((v,i)=>v+p[i]/points.length),[0,0,0]);
    rhythmStanding=[-1,1].map((sign,hand)=>points.flatMap(([key,point])=>{
     const radial=point.map((v,i)=>v-center[i]),length=Math.hypot(...radial),direction=radial.map(v=>v/length);
     // Palm, not wrist, touches the key. Select only reachable notes for this height.
     const wrist=point.map((v,i)=>v*.7-direction[i]*.098);
     return sign*point[0]>=-.001&&Math.hypot(wrist[0]-sign*.1764,wrist[1]-shoulderHeight,wrist[2])<armReach-.025?[{key,point,direction}]:[];
    }).sort((a,b)=>(hand?1:-1)*(a.point[1]-b.point[1])));
    if(rhythmStanding.some(t=>!t.length))reason||='这个身高暂时够不到按钮，调整小人大小后再试';
   }
   if(body2&&spec.kind==='race'){
    // Measured centre/plane of gaming_racing.glb's rubber rim (not its hub).
    const center=gamingPoint(item,[-.12578125,1.228125,.37734375]),normal=gamingPoint({...item,x:0,y:0,z:0},[0,.24,.97077289]);
    const c=Math.cos(spec.rotation),s=Math.sin(spec.rotation);
    wheel={center:inversePose(spec,center),axis:[c*normal[0]-s*normal[2],normal[1],s*normal[0]+c*normal[2]],radius:.298/.7};
   }
   results.push({roomId:room.id,itemId:item.id,stationId:spec.stationId,kind:spec.kind,label:GAMING_ACTIONS[spec.kind]+(spec.label?' · '+spec.label:''),seat,position:spec.position,rotation:spec.rotation,hands,mouseHand:spec.mouseHand?inversePose(spec,spec.mouseHand):undefined,rhythm,rhythmStanding,wheel,dependencies:spec.dependencies,reason});
  }
 }
 return results;
}
function inversePoint(item,p){return inversePose({position:[item.x,item.y,item.z],rotation:item.rotation*Math.PI/180},p,1);}
function inversePose(pose,p,scale=.7){const dx=p[0]-pose.position[0],dz=p[2]-pose.position[2],c=Math.cos(pose.rotation),s=Math.sin(pose.rotation);return [(c*dx-s*dz)/scale,(p[1]-pose.position[1])/scale,(s*dx+c*dz)/scale];}
// Presets contain ordinary independent pieces. Search before changing room state;
// one insertion is one undo, and a full room never receives a partial bundle.
export function gamingPreset(kind,catalog){
 const items=[],put=(assetId,x,z,rotation=0)=>{const i={id:uid(),assetId,x,y:.15,z,rotation,color:null,stored:false};items.push(i);return i;};
 if(kind==='computer'||kind==='stream'){
  const desk=put('gaming_desk',0,-.72),chair=put('gaming_chair',0,.40,180);
  chair.dockId=desk.id;chair.dockSlot='front';const seat=asset(catalog,'gaming_chair').seats[0].position;chair.x=seat[0];chair.z=desk.z+computerSeatOffset(asset(catalog,'gaming_desk'))+seat[2];
  const deskScale=asset(catalog,'gaming_desk').size[0]/3.4;
  const prop=(id,x,z)=>{const i=put(id,x*deskScale,desk.z+z*deskScale);Object.assign(i,snapToSupport(i,{items},catalog));if(!i.supportId)throw Error('预设桌面承托失效：'+id);};
  prop('gaming_monitors',0,-.08);prop('gaming_keyboard',0,.39);prop('gaming_mouse',.85,.40);
  if(kind==='stream'){prop('gaming_microphone',-.925,.575);prop('gaming_webcam',.94,-.47);}
 }else if(kind==='race'){
  const rig=put('gaming_racing',0,-.45),d=asset(catalog,rig.assetId).activity,seat=asset(catalog,'gaming_chair').seats[0].position;
  put('gaming_chair',d.position[0]+seat[0],rig.z+d.position[2]+seat[2],180);
 }else put('gaming_maimai',0,-.45);
 return items;
}
export function placeGamingPreset(kind,room,catalog){
 const base=gamingPreset(kind,catalog);for(const dz of [0,-.4,.4,-.8,.8])for(const dx of [0,-.4,.4,-.8,.8,-1.2,1.2]){
  const items=base.map(i=>({...i,x:i.x+dx,z:i.z+dz})),test={...room,items:[...room.items,...items]};
  if(items.some(i=>placementError(i,test,catalog)))continue;
  const acts=gamingActivities(test,catalog).filter(a=>items.some(i=>i.id===a.itemId));if(acts.some(a=>a.kind===kind&&!a.reason))return items;
 }
 throw Error('这里放不下整套设备和座位，先腾出空间或扩建一间房');
}
