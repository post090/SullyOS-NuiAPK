import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody,BLANK_SCALE} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {BED_LEISURE} from '../apps/room3d/chibi/bedLeisure';
import {furniturePalm} from '../apps/room3d/chibi/furnitureMotion';
import {furnitureInteractions} from '../apps/room3d/furnitureInteractions.js';
import catalog from '../public/room3d/catalog.json';

it('offers bed leisure only after lying in the selected bed, without mutating furniture',()=>{
 const room={id:'r',items:[{id:'bed',assetId:'bedroom_single_bed',x:0,y:.15,z:0,rotation:0}]},saved=JSON.stringify(room);
 const initial=furnitureInteractions(room,catalog,'bed',{body2:true});
 expect(initial.some(a=>a.mode)).toBe(false);
 const seat={bed:true,itemId:'bed',seatId:initial.find(a=>a.action==='chibi-bed').seat};
 const actions=furnitureInteractions(room,catalog,'bed',{body2:true,seat});
 expect(furnitureInteractions(room,catalog,'bed',{body2:true,seat,transitioning:true}).some(a=>a.mode)).toBe(false);
 expect(furnitureInteractions(room,catalog,'bed',{body2:true,seat:{...seat,itemId:'other'}}).some(a=>a.mode)).toBe(false);
 expect(actions.filter(a=>a.mode).map(a=>a.mode)).toEqual(BED_LEISURE.map(([id])=>id));
 expect(furnitureInteractions(room,catalog,'bed').some(a=>a.mode)).toBe(false);
 expect(JSON.stringify(room)).toBe(saved);
});

it('retains supported hip, bone lengths and deterministic poses across sizes and rotated beds',()=>{
 for(const height of [.8,1,1.25])for(const yaw of [0,Math.PI/2]){
  const root=new T.Group(),body=new T.Group(),hair=new T.Group(),geometry=createBlankBody('skin',{bodyHeight:height}),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material);
  root.scale.setScalar(2.8/BLANK_SCALE);root.rotation.y=yaw;root.add(body);body.add(mesh,hair);
  const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body),lengths=rig.skeleton.bones.map(b=>b.position.length());
  const base={kind:'bed-rest',hands:[],bedWeight:1,bedRecline:1};
  animate(0,'sleep','lying',base);root.updateMatrixWorld(true);const hip=rig.bones.hips.getWorldPosition(new T.Vector3());
  for(const [mode]of BED_LEISURE){
   const pose={...base,bedMode:mode};animate(3,'idle','lying',pose);root.updateMatrixWorld(true);
   // Keep the authored horizontal bed anchor. Vertical clearance now follows
   // the actual head/back surface instead of pinning the penetrating hip.
   const supported=rig.bones.hips.getWorldPosition(new T.Vector3());expect(supported.x).toBeCloseTo(hip.x);expect(supported.z).toBeCloseTo(hip.z);
   rig.skeleton.update();let lowest=Infinity;const vertex=new T.Vector3();for(let i=0;i<geometry.attributes.position.count;i++){rig.mesh.getVertexPosition(i,vertex);rig.mesh.localToWorld(vertex);lowest=Math.min(lowest,vertex.y);}
   expect(lowest).toBeGreaterThanOrEqual(-.005);
   const snapshot=rig.skeleton.bones.map(b=>b.quaternion.clone());
   animate(8,'idle','lying',pose);animate(3,'idle','lying',pose);
   rig.skeleton.bones.forEach((b,i)=>{expect(b.quaternion.angleTo(snapshot[i])).toBeLessThan(.0001);expect(b.position.length()).toBeCloseTo(lengths[i],8);expect(b.quaternion.toArray().every(Number.isFinite)).toBe(true);});
  }
  const palm=(side:string)=>body.worldToLocal(rig.bones[side+'_hand'].localToWorld(furniturePalm(side)));
  animate(1.5,'idle','lying',{...base,bedMode:'bed-phone'});const hold=palm('L'),tap=palm('R');
  animate(3.1,'idle','lying',{...base,bedMode:'bed-phone'});
  expect(palm('L').distanceTo(hold)).toBeLessThan(.001);expect(palm('R').distanceTo(tap)).toBeGreaterThan(.005);
  animate(3,'idle','lying',{...base,bedMode:'bed-side'});
  const sidePose=rig.skeleton.bones.map(b=>b.quaternion.clone());
  animate(0,'idle','lying',{...base,bedMode:'bed-phone',bedFrom:'bed-side',bedFromTime:3,bedTime:0});
  rig.skeleton.bones.forEach((b,i)=>expect(b.quaternion.angleTo(sidePose[i])).toBeLessThan(.0001));
  animate(3,'sleep','lying',base);const sleepPose=rig.skeleton.bones.map(b=>b.quaternion.clone());
  animate(3,'sleep','lying',{...base,bedFrom:'bed-side',bedFromTime:3,bedTime:3});
  rig.skeleton.bones.forEach((b,i)=>expect(b.quaternion.angleTo(sleepPose[i])).toBeLessThan(.0001));
  animate(0,'idle','standing');expect(body.quaternion.angleTo(new T.Quaternion())).toBeLessThan(.0001);
  geometry.dispose();material.dispose();rig.skeleton.dispose();
 }
});

