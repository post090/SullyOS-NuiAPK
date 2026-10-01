import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createBlankBody} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';
import {retargetHappyWave} from '../../experiments/chibi/retargetHappyWave';

async function setup(height=1){
 const bytes=readFileSync('public/room3d/animations/happy-wave-source.glb');
 const source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const root=new T.Group(),hair=new T.Group(),body=new T.Mesh(createBlankBody('skin',{bodyHeight:height}),Array.from({length:6},()=>new T.MeshStandardMaterial()));
 root.add(body,hair);return {source,root,rig:bindBlankBody(body,hair)};
}

test('source bind pose maps to identity even with different joint axes and extra spine',async()=>{
 const {source,rig}=await setup();const tracks:T.KeyframeTrack[]=[];
 source.scene.traverse(o=>{if((o as T.Bone).isBone){tracks.push(new T.QuaternionKeyframeTrack(`${o.name}.quaternion`,[0,1],[...o.quaternion.toArray(),...o.quaternion.toArray()]));}});
 const rest=retargetHappyWave(source.scene,new T.AnimationClip('Rest',1,tracks),rig,30,{headLeanDegrees:0,armOutDegrees:0,restHandCurl:0});
 for(const track of rest.tracks)if(track.name.endsWith('.quaternion'))for(let i=0;i<track.values.length;i+=4){
  assert.ok(new T.Quaternion().fromArray(track.values,i).angleTo(new T.Quaternion())<1e-5,track.name);
 }
});

test('selected wave animates both models, preserves bone lengths, fingers and source state',async()=>{
 for(const height of [.8,1,1.25]){
  const {source,root,rig}=await setup(height);assert.equal(source.animations.length,1);
  const clothing=dressHoodie(rig);const saved=rig.skeleton.bones.map(b=>b.position.clone());
  const transforms=()=>{const result:number[][]=[];source.scene.traverse(o=>result.push([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));return result;};
  const sourceBefore=transforms();const clip=retargetHappyWave(source.scene,source.animations[0],rig);
  assert.deepEqual(transforms(),sourceBefore);assert.equal(clip.tracks.length,32);
  assert.equal(clip.duration,source.animations[0].duration);assert.equal(rig.skeleton.bones.length,42);
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const handPositions:T.Vector3[]=[];
  for(let frame=0;frame<=92;frame++){
   mixer.setTime(clip.duration*frame/92);root.updateMatrixWorld(true);rig.skeleton.update();
   for(let i=0;i<rig.skeleton.bones.length;i++){
    const bone=rig.skeleton.bones[i];if(bone.name!=='hips')assert.ok(bone.position.distanceTo(saved[i])<1e-6);
    if(i>=22){const angle=bone.quaternion.angleTo(new T.Quaternion());
     if(bone.name.startsWith('L_'))assert.ok(angle<1e-6);
     else assert.ok(angle>.1&&angle<.5,'Resting fingers should curl gently');
    }
   }
   for(const mesh of [rig.mesh,...clothing.meshes])for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    const point=mesh.getVertexPosition(i,new T.Vector3());assert.ok(Number.isFinite(point.lengthSq())&&point.length()<20);
   }
   handPositions.push(rig.bones.L_hand.getWorldPosition(new T.Vector3()));
  }
  assert.ok(handPositions.some(p=>p.distanceTo(handPositions[0])>1),'Wave hand must move');
  mixer.stopAllAction();mixer.uncacheRoot(root);
 }
});

test('rejects absent mapped joints instead of silently emitting a broken clip',async()=>{
 const {source,rig}=await setup();delete rig.bones.L_hand;
 assert.throws(()=>retargetHappyWave(source.scene,source.animations[0],rig),/Missing bone/);
});
