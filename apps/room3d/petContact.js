import * as THREE from 'three';
import {petMap} from './petLife.js';
const smooth=(t,a,b)=>THREE.MathUtils.smootherstep(t,a,b);
// A contact owns one exact pet action; positions on disk always remain safe floor positions.
export function createPetContact({life,home,catalog,bridge,headPoint}){
 let session=null;
 const point=new THREE.Vector3();
 function cancel(stop=true,persist=true){if(!session)return;const s=session;session=null;if(life.runtime.get(s.pet.id)===s.runtime)life.runtime.delete(s.pet.id);if(stop)s.actor.stop();s.actor.reset(!stop);if(persist)life.save();}
 function start(id,kind,options={}){
  if(!['pet','play','carry'].includes(kind))throw Error('未知接触动作');
  if(session){if(session.pet.id===id&&session.phase==='held'&&kind==='carry')return drop();throw Error('先完成当前互动，或把怀里的小伙伴放下来');}
  const pet=life.data.pets.find(p=>p.id===id);if(!pet||pet.roomId!==home().activeRoomId)throw Error('先到它所在的房间');
  if(life.wake?.(id))throw Error('等小伙伴先跳下来');
  if(life.runtime.get(id)?.manual)throw Error('等这次互动结束再来吧');
  if(!bridge)throw Error('先邀请你的小人到房间里');
  const actor=bridge(pet,options);const runtime={kind,manual:true,external:true,path:[],phase:0,duration:kind==='carry'?2.4:6,actorId:options.actorId||'user',actorName:options.actorName,source:options.source};
  session={pet,actor,runtime,kind,phase:'approach',time:0,roomId:pet.roomId,ground:[pet.x,.18,pet.z],heading:pet.rotation};life.runtime.set(id,runtime);
 }
 function floorSpot(s){
  const {group}=s.actor,room=home().rooms.find(r=>r.id===s.roomId);if(!room)return null;
  const map=petMap(room,catalog,s.pet,life.data.pets.filter(p=>p.id!==s.pet.id));
  for(const distance of [.85,1,1.2])for(const angle of [0,.5,-.5,1,-1,Math.PI]){
   point.set(Math.sin(group.rotation.y+angle)*distance+group.position.x,.18,Math.cos(group.rotation.y+angle)*distance+group.position.z);
   if(map.free(point.x,point.z))return point.toArray();
  }return null;
 }
 function drop(){
  const s=session;if(!s||s.phase!=='held')throw Error('先把小伙伴抱稳');
  const target=floorSpot(s);if(!target)throw Error('脚边没有足够空地，再往宽敞处走一点');
  s.actor.stop();s.ground=target;s.actor.face(target);s.phase='lower';s.time=0;s.runtime.phase=0;s.runtime.duration=2.4;
 }
 function tick(dt,active){
  const s=session;if(!s)return false;
  if(!s.actor.valid()||home().activeRoomId!==s.roomId||life.runtime.get(s.pet.id)!==s.runtime){cancel(false);return false;}
  if(!active)return true;
  if(!['approach','held'].includes(s.phase)&&s.actor.walking()){cancel(false);return false;}
  if(s.phase==='approach'){
   if(s.actor.walking())return true;
   if(Math.hypot(s.actor.group.position.x-s.pet.x,s.actor.group.position.z-s.pet.z)>1.35){cancel(false);return false;}
   s.actor.face(s.ground);s.pet.rotation=Math.atan2(s.actor.group.position.x-s.pet.x,s.actor.group.position.z-s.pet.z);s.heading=s.pet.rotation;s.phase=s.kind!=='carry'?'stroke':'lift';s.time=0;
  }
  s.time+=dt;
  if(s.phase==='held'){const floor=floorSpot(s);if(floor){[s.pet.x,,s.pet.z]=floor;s.pet.rotation=s.actor.group.rotation.y;}return true;}
  s.runtime.phase=s.time;
  if(s.phase==='stroke'&&s.time>=6){life.complete(s.pet.id,s.runtime);session=null;s.actor.reset();}
  else if(s.phase==='lift'&&s.time>=2.4){s.phase='held';s.time=0;s.runtime.phase=0;life.recordContact?.(s.pet.id,'被你抱在怀里');}
  else if(s.phase==='lower'&&s.time>=2.4){[s.pet.x,,s.pet.z]=s.ground;s.pet.rotation=s.actor.group.rotation.y-Math.PI/2;life.complete(s.pet.id,s.runtime);life.save();session=null;s.actor.reset();}
  return true;
 }
 function frame(){
  const s=session;if(!s||s.phase==='approach')return null;
  const a=catalog.find(a=>a.id===s.pet.assetId),size=a.size.map(v=>v*.75),group=s.actor.group;
  group.updateWorldMatrix(true,true);
  const chest=group.worldToLocal(s.actor.visitor.rig.bones.chest.getWorldPosition(new THREE.Vector3()));
  // Measure the standing chest once: crouching must not feed back into the lift target.
  s.chest??=chest.y;
  const heldLocal=new THREE.Vector3(0,s.chest-size[1]*.53,.20+size[0]*.40),held=group.localToWorld(heldLocal.clone());
  const t=s.time,crouch=s.phase==='stroke'?smooth(t,0,.8)*(1-smooth(t,5.1,6)):s.phase==='lift'?smooth(t,0,.7)*(1-smooth(t,1,2.4)):s.phase==='lower'?smooth(t,0,.9)*(1-smooth(t,1.6,2.4)):0;
  const lift=s.phase==='held'?1:s.phase==='lift'?smooth(t,.7,2.2):s.phase==='lower'?1-smooth(t,.2,1.5):0;
  const position=new THREE.Vector3(...s.ground).lerp(held,lift);
  let hands;
  if(s.phase==='stroke'){
   const head=headPoint?.(s.pet)||new THREE.Vector3(s.pet.x,.18+size[1]*.78,s.pet.z).add(new THREE.Vector3(Math.sin(s.pet.rotation)*size[2]*.18,0,Math.cos(s.pet.rotation)*size[2]*.18));
   const local=group.worldToLocal(head);local.x+=Math.sin(t*4)*.06;
   hands=[local.toArray(),[-.24,s.chest*.30,.34]];
  }else{const local=group.worldToLocal(position.clone());hands=[[-size[2]*.38,local.y+size[1]*.18,local.z],[size[2]*.38,local.y+size[1]*.18,local.z]];}
  return {actorId:s.runtime.actorId,petId:s.pet.id,position,rotation:s.phase==='stroke'?s.pet.rotation:s.phase==='lift'?s.heading+Math.atan2(Math.sin(group.rotation.y-Math.PI/2-s.heading),Math.cos(group.rotation.y-Math.PI/2-s.heading))*lift:group.rotation.y-Math.PI/2,activity:{kind:'pet-contact',hands:hands.map(p=>p.map(v=>v/.7)),petCrouch:crouch},time:t,phase:s.phase};
 }
 return {start,drop,cancel,tick,frame,get busy(){return !!session;},inspect:()=>session?{actorId:session.runtime.actorId,petId:session.pet.id,kind:session.kind,phase:session.phase,time:session.time,actorPosition:session.actor.group.position.toArray(),hands:['R','L'].map(side=>session.actor.visitor.rig.bones[side+'_hand'].getWorldPosition(new THREE.Vector3()).toArray()),targets:frame()?.activity.hands.map(p=>session.actor.group.localToWorld(new THREE.Vector3(...p).multiplyScalar(.7)).toArray())}:null};
}
