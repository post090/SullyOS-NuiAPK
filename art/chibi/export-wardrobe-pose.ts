import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {BLANK_SCALE,createBlankBody} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';
import {createWardrobePose,createWardrobeEntrance} from '../../experiments/chibi/wardrobePose';
class Reader{result:unknown;onloadend?:()=>void;readAsArrayBuffer(b:Blob){void b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}}
(globalThis as unknown as {FileReader:unknown}).FileReader=Reader;
mkdirSync('output/wardrobe-pose',{recursive:true});
for(const style of ['cute','boy'] as const)for(const dressed of [false,true]){
 const scene=new T.Scene(),hair=new T.Group(),mesh=new T.Mesh(createBlankBody('skin'),Array.from({length:6},()=>new T.MeshStandardMaterial({color:'#eed5c4',roughness:1})));
 mesh.name='TinyBody';scene.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true),clothes=dressed?dressHoodie(rig):undefined;
 if(clothes){
  const g=clothes.meshes[1].geometry,idx=g.index!,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  for(let i=0;i<idx.count;i+=3){const sides=new Set<string>();
   for(let j=0;j<3;j++)for(let k=0;k<4;k++){const id=idx.getX(i+j);if(sw.array[id*4+k]>1e-6)sides.add(rig.skeleton.bones[si.array[id*4+k]].name[0]);}
   assert.equal(sides.size,1,'Each boot triangle follows only one leg');
  }
 }
 const clip=createWardrobePose(rig,style),rest=rig.skeleton.bones.map(b=>b.position.clone());
 const mixer=new T.AnimationMixer(scene);mixer.clipAction(clip).play();mixer.setTime(.5);scene.updateMatrixWorld(true);rig.skeleton.update();
 const feet=new Map<string,T.Vector3>();
 for(let frame=0;frame<=120;frame++){
  mixer.setTime(frame/30);scene.updateMatrixWorld(true);rig.skeleton.update();
  for(const b of rig.skeleton.bones)assert.ok(Math.abs(b.quaternion.length()-1)<1e-5);
  const facing=(name:string)=>new T.Vector3(0,0,1).applyQuaternion(rig.bones[name].getWorldQuaternion(new T.Quaternion())).x;
  assert.ok(facing('head')<0&&facing('chest')>0,'Head turns right while chest turns left');
  if(style==='boy'){
   const chest=rig.bones.chest,target=new T.Vector3(-.122,-.143*rig.bodyHeight,.048).multiplyScalar(BLANK_SCALE).applyQuaternion(chest.getWorldQuaternion(new T.Quaternion())).add(chest.getWorldPosition(new T.Vector3()));
   assert.ok(rig.bones.R_hand.getWorldPosition(new T.Vector3()).distanceTo(target)<1e-5,'Hip wrist follows waist target');
   const palm=new T.Vector3(0,-1,0).applyQuaternion(rig.bones.L_hand.getWorldQuaternion(new T.Quaternion()));
   const thumb=new T.Vector3(0,0,1).applyQuaternion(rig.bones.R_hand.getWorldQuaternion(new T.Quaternion()));
   assert.ok(palm.y>.8&&thumb.y<-.5,'Presentation palm up and hip thumb down');
  }
  const supporting=rig.bones.L_foot.getWorldPosition(new T.Vector3()),lifted=rig.bones.R_foot.getWorldPosition(new T.Vector3());
  if(frame===0)feet.set('L_foot',supporting);else assert.ok(supporting.distanceTo(feet.get('L_foot')!)<1e-6,'Supporting foot must stay planted');
  if(style==='cute')assert.ok(lifted.y-supporting.y>.1&&lifted.y-supporting.y<.4,'Other foot should lift only a little');
  else{if(frame===0)feet.set('R_foot',lifted);else assert.ok(lifted.distanceTo(feet.get('R_foot')!)<1e-6,'Boy stance keeps both feet planted');}
  for(const m of [rig.mesh,...clothes?.meshes??[]])for(let i=0;i<m.geometry.attributes.position.count;i++)assert.ok(Number.isFinite(m.getVertexPosition(i,new T.Vector3()).lengthSq()));
 }
 for(const track of clip.tracks){const count=track.values.length;for(let i=0;i<4;i++)assert.equal(track.values[i],track.values[count-4+i],'Loop must close');}
 const head=clip.tracks.find(t=>t.name==='head.quaternion')!;assert.ok(head.values.some((v,i)=>Math.abs(v-head.values[i%4])>.01),'Head must actually animate');
 mixer.setTime(0);scene.updateMatrixWorld(true);rig.skeleton.update();
 rig.skeleton.bones.forEach((b,i)=>assert.ok(b.position.distanceTo(rest[i])<1e-7));
 for(const m of [rig.mesh,...clothes?.meshes??[]])for(let i=0;i<m.geometry.attributes.position.count;i++)assert.ok(Number.isFinite(m.getVertexPosition(i,new T.Vector3()).lengthSq()));
 for(const [side,prefix] of [[1,'L'],[-1,'R']] as const){const hand=rig.bones[`${prefix}_hand`].getWorldPosition(new T.Vector3()),elbow=rig.bones[`${prefix}_forearm`].getWorldPosition(new T.Vector3());
  if(style==='boy'&&prefix==='R')assert.ok(hand.x>elbow.x&&hand.z>.15,'Hip hand should turn inward and sit in front of the waist');
  else assert.ok(side*(hand.x-elbow.x)>.1,'Presentation arm should open outward');
 }
 for(const prefix of ['L','R']){const direction=new T.Vector3(0,0,1).applyQuaternion(rig.bones[`${prefix}_foot`].getWorldQuaternion(new T.Quaternion()));
  if(style==='cute')assert.ok(prefix==='L'?direction.x<0:direction.x>0,'Feet should turn slightly inward');
  else assert.ok(prefix==='L'?Math.abs(direction.x)<1e-6:direction.x<-.3,'Boy stance: one foot forward, one outward');
 }
 // Store the posed display with unchanged inverse-bind matrices and the idle loop.
 const entrance=createWardrobeEntrance(rig,clip);
 for(let i=0;i<clip.tracks.length;i++){
  const a=entrance.tracks[i],b=clip.tracks[i];
  for(let k=0;k<4;k++)assert.ok(Math.abs(a.values[a.values.length-4+k]-b.values[k])<1e-6,'Entry must join idle without a pose jump');
 }
 mixer.stopAllAction();const entry=mixer.clipAction(entrance);entry.setLoop(T.LoopOnce,1);entry.clampWhenFinished=true;entry.play();
 for(let frame=0;frame<=42;frame++){
  entry.paused=false;mixer.setTime(frame/30);scene.updateMatrixWorld(true);rig.skeleton.update();
  const left=rig.bones.L_foot.getWorldPosition(new T.Vector3()),right=rig.bones.R_foot.getWorldPosition(new T.Vector3());
  if(style==='cute')assert.ok(left.distanceTo(feet.get('L_foot')!)<1e-6,'Supporting foot stays still during entry');
  else assert.ok(left.y>=0&&left.y<.4&&right.y>=0&&right.y<.4,'Stance opening must remain near the ground');
  if(frame===0)assert.ok(Math.abs(right.y-left.y)<1e-6,'Entry starts with both feet on the ground');
  rig.skeleton.bones.forEach((b,i)=>assert.ok(b.position.distanceTo(rest[i])<1e-7));
  for(const m of [rig.mesh,...clothes?.meshes??[]])for(let i=0;i<m.geometry.attributes.position.count;i++)assert.ok(Number.isFinite(m.getVertexPosition(i,new T.Vector3()).lengthSq()));
 }
 entry.paused=false;mixer.setTime(0);scene.updateMatrixWorld(true);rig.skeleton.update();
 const data=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[entrance,clip]}) as ArrayBuffer;
 const parsed=await new GLTFLoader().parseAsync(data,'');assert.deepEqual(parsed.animations.map(c=>c.name),[entrance.name,clip.name]);assert.ok(parsed.animations.every(c=>c.tracks.length===rig.skeleton.bones.length));
 parsed.scene.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)assert.equal((o as T.SkinnedMesh).skeleton.bones.length,rig.skeleton.bones.length);});
 const suffix=style==='boy'?'-boy':'';
 const path=`output/wardrobe-pose/tiny-wardrobe-stand${suffix}-${dressed?'hoodie':'body'}.glb`;writeFileSync(path,Buffer.from(data));console.log(`${path}: pose, bone lengths, toe direction and GLB roundtrip passed`);
 if(!dressed)writeFileSync(`output/wardrobe-pose/wardrobe-stand${suffix}.json`,JSON.stringify(T.AnimationClip.toJSON(clip)));
 const memory=(c:T.AnimationClip)=>c.tracks.reduce((sum,t)=>sum+t.times.byteLength+t.values.byteLength,0);
 console.log(JSON.stringify({style,dressed,glbBytes:data.byteLength,entranceKeyframeBytes:memory(entrance),idleKeyframeBytes:memory(clip),totalKeyframeBytes:memory(entrance)+memory(clip)}));
 if(!dressed)writeFileSync(`output/wardrobe-pose/stand-to-wardrobe${suffix}.json`,JSON.stringify(T.AnimationClip.toJSON(entrance)));
}
