import {it,expect} from 'vitest';
import * as T from 'three';
import catalog from '../public/room3d/catalog.json';
import {gamingActivities,gamingPreset} from '../apps/room3d/gaming.js';
import {rhythmFrame} from '../apps/room3d/rhythm.js';
import {createBlankBody,BLANK_SCALE} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {bodyHeightY} from '../apps/room3d/chibi/bodyHeight';
import {furniturePalm,racingHands} from '../apps/room3d/chibi/furnitureMotion';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createGamingEffects} from '../apps/room3d/gamingEffects.js';
import {diningGrip} from '../apps/room3d/diningGrip.js';
import {createKitchenEffects} from '../apps/room3d/kitchenEffects.js';
function actor(bodyHeight=1){const parent=new T.Group(),body=new T.Group(),hair=new T.Group(),mesh=new T.Mesh(createBlankBody('skin',{bodyHeight}),new T.MeshBasicMaterial());parent.scale.setScalar(2.8/BLANK_SCALE);parent.add(body);body.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true);return {parent,body,rig,animate:createBlankMotion(rig,body)};}
it('keeps the spoon hand outside the face and attaches each spoon to its own grip',()=>{
 for(const height of [.8,1,1.25])for(const angle of [0,Math.PI/2,Math.PI]){
  const a=actor(height),resident=new T.Group();resident.add(a.parent);resident.rotation.y=angle;
  const activity={kind:'eat',hands:[[-.2,.92,.94],[.2,.92,.94]],meal:[0,.92,.94],handScale:.7/a.parent.scale.y};
  const effects=createKitchenEffects(resident);
  for(const time of [.9,1.1,1.3,1.5]){
   a.animate(time,'eat','seated',activity);
   const local=a.rig.bones.head.worldToLocal(a.rig.bones.L_hand.getWorldPosition(new T.Vector3()));
   expect(local.z/BLANK_SCALE).toBeGreaterThan(.17);
   const grip=diningGrip(resident,a.rig);effects.updateMeal(activity,time,grip);
   const spoon=effects.meal.getObjectByName('meal-spoon')!;
   expect(resident.worldToLocal(spoon.getWorldPosition(new T.Vector3())).distanceTo(new T.Vector3(...grip.position))).toBeLessThan(1e-6);
   expect(spoon.quaternion.angleTo(grip.rotation)).toBeLessThan(1e-6);
  }
  effects.updateMeal(null,0);expect(effects.meal.visible).toBe(false);effects.dispose();
 }
});
it('body 2 palms reach the actual wheel and standing rhythm buttons without changing bone lengths',()=>{
 for(const kind of ['race','rhythm'] as const)for(const height of [.8,1,1.25]){
 const room={id:'r',items:gamingPreset(kind,catalog),walls:[],doors:[]};
 const acts=gamingActivities(room,catalog,{body2:true,shoulderHeight:bodyHeightY(.59*BLANK_SCALE,height)*2.8/BLANK_SCALE});expect(acts.map(a=>a.reason),kind+" height "+height).toEqual(acts.map(()=>""));
 for(const activity of acts.filter(a=>a.kind===kind)){
 const a=actor(height),lengths=a.rig.skeleton.bones.map(b=>b.position.length()),pose={...activity,handScale:.7/a.parent.scale.y};let feet:number[][]|undefined;
 for(let frame=0;frame<40;frame++){
 const time=1+frame*.09;
 a.animate(time,kind,kind==='race'?'seated':'standing',pose);a.parent.updateMatrixWorld(true);
 const beat=kind==='rhythm'?rhythmFrame(activity,time):null,targets=beat?beat.hands:racingHands(activity.hands,time,activity.wheel);
 const errors=['R','L'].map((side,i)=>a.rig.bones[side+'_hand'].localToWorld(furniturePalm(side,kind==='race')).distanceTo(new T.Vector3(...targets[i]).multiplyScalar(.7)));
 expect(Math.max(...errors),kind+' height '+height+' t '+time).toBeLessThan(.03);
 if(kind==='race')for(const side of ['R','L']){
  const thumb=a.rig.bones[side+'_thumb'].getWorldPosition(new T.Vector3()),pinky=a.rig.bones[side+'_pinky'].getWorldPosition(new T.Vector3());
  expect(thumb.y-pinky.y,'thumb stays above the little finger when gripping').toBeGreaterThan(.08);
 }
 if(kind==='rhythm'){
 expect(a.body.position.length()).toBe(0);
 const now=['R','L'].map(side=>a.rig.bones[side+'_foot'].getWorldPosition(new T.Vector3()).toArray());if(feet)expect(now).toEqual(feet);feet=now;
 }
 expect(a.rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);expect(a.rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
 }
 a.animate(0,'idle','standing');expect(a.body.position.length()).toBe(0);expect(a.rig.skeleton.bones).toHaveLength(48);
 }
 }
});
it('standing rhythm alternates independent heights quickly and lights only contacted keys',()=>{
 const room={id:'r',items:gamingPreset('rhythm',catalog),walls:[],doors:[]},acts=gamingActivities(room,catalog,{body2:true});
 for(const act of acts){let staggered=0;const lit=new Set<string>();
 for(let i=0;i<120;i++){const beat=rhythmFrame(act,i*.025)!;if(Math.abs(beat.hands[0][1]-beat.hands[1][1])>.2)staggered++;
 for(const key of beat.keys){lit.add(key);const entry=act.rhythmStanding!.flat().find(p=>p.key===key)!;expect(Math.min(...beat.hands.map(p=>Math.hypot(...p.map((v,k)=>v-entry.point[k]))))).toBeLessThan(.001);}}
 expect(staggered).toBeGreaterThan(30);expect(lit.size).toBeGreaterThanOrEqual(4);
 }
});
it('grip contacts stay on the actual GLB rim as the whole wheel turns in every room heading',async()=>{
 const data=readFileSync('public/room3d/gaming_racing.glb'),loaded=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const model=loaded.scene,bounds=new T.Box3().setFromObject(model);model.scale.setScalar(1.6/bounds.getSize(new T.Vector3()).x);bounds.setFromObject(model);
 const center=bounds.getCenter(new T.Vector3());model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));const object=new T.Group();object.add(model);
 const wheels:T.Mesh[]=[];model.traverse(o=>{if(o instanceof T.Mesh&&o.userData.gamingRole==='wheel')wheels.push(o);});
 const rim=wheels.reduce((a,b)=>a.geometry.attributes.position.count>b.geometry.attributes.position.count?a:b),effects=createGamingEffects();
 for(const heading of [0,90,180,270]){
  const angle=heading*Math.PI/180,room={id:'r',items:gamingPreset('race',catalog),walls:[],doors:[]};room.items=room.items.map(i=>({...i,x:Math.cos(angle)*i.x+Math.sin(angle)*i.z,z:-Math.sin(angle)*i.x+Math.cos(angle)*i.z,rotation:(i.rotation+heading)%360}));
  const activity=gamingActivities(room,catalog,{body2:true})[0],item=room.items[0];object.position.set(item.x,item.y,item.z);object.rotation.y=angle;object.userData.itemId=item.id;
  for(const time of [1,2,3]){
   effects.update([object],activity,time);object.updateMatrixWorld(true);
   for(const hand of racingHands(activity.hands,time,activity.wheel)){
    const goal=new T.Vector3(...hand).multiplyScalar(.7).applyAxisAngle(new T.Vector3(0,1,0),activity.rotation).add(new T.Vector3(...activity.position));let closest=Infinity;
    for(let i=0;i<rim.geometry.attributes.position.count;i++)closest=Math.min(closest,new T.Vector3().fromBufferAttribute(rim.geometry.attributes.position,i).applyMatrix4(rim.matrixWorld).distanceTo(goal));
    expect(closest).toBeLessThan(.045);
   }
  }
  effects.clear();for(const wheel of wheels){expect(wheel.position.length()).toBe(0);expect(wheel.quaternion.angleTo(new T.Quaternion())).toBe(0);}
 }
});

it('eating lifts a real hand toward the lower face; hugging reaches the prop and both release cleanly',()=>{
 for(const kind of ['eat','hug'] as const){const a=actor();const activity={kind,hands:[[-.40,kind==='hug'?2.05:.50,.65],[.40,kind==='hug'?2.05:.50,.65]],handScale:.7/a.parent.scale.y};
 const posture=kind==='eat'?'seated':'standing';a.animate(2.6,kind,posture,activity);const before=a.rig.bones.L_hand.getWorldPosition(new T.Vector3());a.animate(1.3,kind,posture,activity);const after=a.rig.bones.L_hand.getWorldPosition(new T.Vector3());
 if(kind==='eat')expect(after.y).toBeGreaterThan(before.y+.20);
 else for(const [i,side]of ['R','L'].entries())expect(a.rig.bones[side+'_hand'].getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...activity.hands[i]).multiplyScalar(.7))).toBeLessThan(.03);
 const lengths=a.rig.skeleton.bones.map(b=>b.position.length());a.animate(0,'idle','standing');expect(a.body.position.length()).toBe(0);expect(a.rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
 }
});

import {seatTransform} from '../apps/room3d/seating.js';
import {body2BedTransform} from '../apps/room3d/bedMotion.js';
it('all registered bed slots align the crown in their own facing direction, including rotated bunk beds',()=>{
 for(const asset of catalog.filter(a=>a.beds))for(const slot of asset.beds!)for(const rotation of [0,90,180,270]){
 const item={id:'bed',assetId:asset.id,x:2,y:.15,z:-1,rotation},selection={roomId:'r',itemId:'bed',seatId:slot.id,bed:true};
 const raw=seatTransform({id:'r',items:[item]},catalog,selection,true),pose=body2BedTransform(raw,1.45);expect(pose.pose).toBe('bed');
 const along=(pose.position[0]-item.x)*Math.sin(pose.rotation)+(pose.position[2]-item.z)*Math.cos(pose.rotation);
 expect(along-1.45).toBeCloseTo(pose.bed.headEnd);expect(pose.position[1]).toBeCloseTo(item.y+slot.position[1]);
 }
});
it('ordinary low seats lift feet above the floor while preserving the pelvis contact',()=>{
 for(const asset of catalog.filter(a=>a.seats))for(const slot of asset.seats!){
 const a=actor(),height=.15+slot.position[1]-.18;
 a.animate(2,'idle','seated',{kind:'seat-rest',hands:[],seatHeight:height/a.parent.scale.y,seatPose:'chair'});
 for(const side of ['R','L'])expect(a.rig.bones[side+'_foot'].getWorldPosition(new T.Vector3()).y+height).toBeGreaterThan(.12);
 }
});
