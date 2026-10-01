import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createBlankBody} from '../../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import {dressHoodie} from '../../apps/room3d/chibi/hoodieClothes';
import {retargetHappyWave} from '../../experiments/chibi/retargetHappyWave';
class Reader{result:any;onloadend:any;readAsArrayBuffer(b:Blob){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}}
(globalThis as any).FileReader=Reader;
const bytes=readFileSync('public/room3d/animations/happy-wave-source.glb');
const source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const input=source.animations[0];assert.ok(input);assert.equal(source.animations.length,1);
mkdirSync('output/happy-wave',{recursive:true});
for(const hoodie of [false,true]){
 const scene=new T.Scene(),geo=createBlankBody('skin');
 const mesh=new T.Mesh(geo,Array.from({length:6},()=>new T.MeshStandardMaterial({color:'#eed5c4',roughness:1})));mesh.name='TinyBody';
 const hair=new T.Group();scene.add(mesh,hair);const rig=bindBlankBody(mesh,hair);
 if(hoodie)dressHoodie(rig);
 const rest=rig.skeleton.bones.map(b=>b.position.clone());
 const clip=retargetHappyWave(source.scene,input,rig);
 assert.equal(clip.tracks.length,32);assert.equal(rig.skeleton.bones.length,42);
 assert.ok(clip.tracks.every(t=>t.name.endsWith('.quaternion')||t.name==='hips.position'));
 const mixer=new T.AnimationMixer(scene);const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 let maxHeight=0;const samples=[];
 for(let i=0;i<=92;i++){
  mixer.setTime(input.duration*i/92);scene.updateMatrixWorld(true);rig.skeleton.update();
  for(let j=0;j<rig.skeleton.bones.length;j++){const b=rig.skeleton.bones[j];if(b.name!=='hips')assert.ok(b.position.distanceTo(rest[j])<1e-6);assert.ok(Math.abs(b.quaternion.length()-1)<1e-5);}
  scene.traverse((o:any)=>{if(o.isSkinnedMesh){o.boundingBox=null;o.boundingSphere=null;const v=new T.Vector3();for(let k=0;k<o.geometry.attributes.position.count;k++){o.getVertexPosition(k,v);assert.ok(Number.isFinite(v.lengthSq()));}}});const box=new T.Box3().setFromObject(scene);assert.ok(Number.isFinite(box.min.lengthSq()+box.max.lengthSq()));maxHeight=Math.max(maxHeight,box.max.y-box.min.y);
  if(i%23===0)samples.push({time:input.duration*i/92,bounds:[box.min.toArray(),box.max.toArray()],leftHand:rig.bones.L_hand.getWorldPosition(new T.Vector3()).toArray()});
 }
 mixer.stopAllAction();mixer.uncacheRoot(scene);rig.setPose('bind');
 const glb=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[clip]}) as ArrayBuffer;
 const out=`output/happy-wave/tiny-happy-wave-${hoodie?'hoodie':'body'}.glb`;writeFileSync(out,Buffer.from(glb));
 const roundtrip=await new GLTFLoader().parseAsync(glb,'');assert.equal(roundtrip.animations.length,1);assert.equal(roundtrip.animations[0].name,'HappyWave');
 if(!hoodie)writeFileSync('public/room3d/animations/happy-wave.json',JSON.stringify(T.AnimationClip.toJSON(clip)));
 console.log(JSON.stringify({out,bones:42,duration:clip.duration,tracks:clip.tracks.length,maxHeight,samples}));
}
