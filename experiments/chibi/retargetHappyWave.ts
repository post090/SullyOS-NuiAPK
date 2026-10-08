import * as T from 'three';
import type {bindBlankBody} from '../../apps/room3d/chibi/blankRig';

// World-space bind corrections also absorb Meshy's extra Spine1 joint.
export const HAPPY_WAVE_BONES: Record<string,string> = {
 hips:'Hips',spine:'Spine',chest:'Spine2',neck:'Neck',head:'Head',
 L_clavicle:'LeftShoulder',L_upperArm:'LeftArm',L_forearm:'LeftForeArm',L_hand:'LeftHand',
 R_clavicle:'RightShoulder',R_upperArm:'RightArm',R_forearm:'RightForeArm',R_hand:'RightHand',
 L_thigh:'LeftUpLeg',L_shin:'LeftLeg',L_foot:'LeftFoot',L_toe:'LeftToeBase',
 R_thigh:'RightUpLeg',R_shin:'RightLeg',R_foot:'RightFoot',R_toe:'RightToeBase',
};

/** Bake on fresh, untransformed source/target roots. Never copy limb translations:
 * they encode Meshy's bone lengths, not ours. Source and target share Y-up/+Z-front.
 * The caller owns the source scene; baking restores both rigs before returning.
 */
export function retargetHappyWave(source:T.Object3D,clip:T.AnimationClip,rig:ReturnType<typeof bindBlankBody>,fps=30,
 {headLeanDegrees=10,armOutDegrees=30,restHandCurl=.3}:{headLeanDegrees?:number;armOutDegrees?:number;restHandCurl?:number}={}){
 if(!(clip.duration>0)||!Number.isFinite(clip.duration)||!Number.isFinite(fps)||fps<1||fps>120)throw Error('Invalid animation duration or sample rate');
 let skin:T.SkinnedMesh|undefined;
 source.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh&&!skin)skin=o as T.SkinnedMesh;});
 if(!skin)throw Error('Source has no skinned mesh');
 const clean=(name:string)=>name.replace(/^mixamorig[:_]?/,'');
 const sourceBones=new Map(skin.skeleton.bones.map((bone,i)=>[clean(bone.name),{bone,bind:skin!.skeleton.boneInverses[i].clone().invert()}]));
 const mapped=Object.entries(HAPPY_WAVE_BONES).map(([target,name])=>{
  const entry=sourceBones.get(name),bone=rig.bones[target];
  if(!entry||!bone)throw Error(`Missing bone: ${target} / ${name}`);
  const targetBind=rig.skeleton.boneInverses[rig.skeleton.bones.indexOf(bone)].clone().invert();
  return {bone,source:entry.bone,sourceBind:entry.bind,correction:new T.Quaternion().setFromRotationMatrix(entry.bind).invert().multiply(new T.Quaternion().setFromRotationMatrix(targetBind)),values:[] as number[]};
 });
 const hip=mapped[0],sourceHip=new T.Vector3().setFromMatrixPosition(hip.sourceBind),targetHip=hip.bone.position.clone();
 const ratio=targetHip.y/sourceHip.y;
 if(!Number.isFinite(ratio)||ratio<=0)throw Error('Invalid hip height');
 const saved=rig.skeleton.bones.map(b=>({bone:b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
 const sourceSaved:Array<{bone:T.Object3D;p:T.Vector3;q:T.Quaternion;s:T.Vector3}>=[];
 source.traverse(bone=>sourceSaved.push({bone,p:bone.position.clone(),q:bone.quaternion.clone(),s:bone.scale.clone()}));
 const mixer=new T.AnimationMixer(source),action=mixer.clipAction(clip);
 action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const times:number[]=[],positions:number[]=[],world=new T.Quaternion(),parent=new T.Quaternion(),v=new T.Vector3();
 const hand=sourceBones.get('LeftHand')!.bone,arm=sourceBones.get('LeftArm')!.bone;
 const handPosition=new T.Vector3(),armPosition=new T.Vector3(),lean=new T.Quaternion(),armOut=new T.Quaternion(),forward=new T.Vector3(0,0,1);
 const leanAngle=T.MathUtils.degToRad(Number.isFinite(headLeanDegrees)?T.MathUtils.clamp(headLeanDegrees,0,20):10);
 const armAngle=T.MathUtils.degToRad(Number.isFinite(armOutDegrees)?T.MathUtils.clamp(armOutDegrees,0,45):30);
 const fingers=Object.fromEntries(Object.keys(rig.bones).map(name=>[name,new T.Quaternion()]));
 rig.setHandCurl('R',restHandCurl,fingers);
 const fingerTracks=rig.skeleton.bones.slice(22).filter(b=>b.name.startsWith('R_')).map(b=>
  new T.QuaternionKeyframeTrack(`${b.name}.quaternion`,[0,clip.duration],[...fingers[b.name].toArray(),...fingers[b.name].toArray()]));
 const frames=Math.ceil(clip.duration*fps);
 try{
  for(let i=0;i<=frames;i++){
   const time=Math.min(i/fps,clip.duration);times.push(time);mixer.setTime(time);source.updateMatrixWorld(true);
   const raised=(hand.getWorldPosition(handPosition).y-arm.getWorldPosition(armPosition).y)/sourceHip.y;
   const lift=T.MathUtils.smoothstep(raised,.05,.30);
   lean.setFromAxisAngle(forward,leanAngle*lift);
   const reachAngle=Math.atan2(handPosition.y-armPosition.y,handPosition.x-armPosition.x);
   // The inward sweep needs more clearance than the outward part: keep the
   // shoulder-to-wrist direction outside a 60-degree cone above horizontal.
   const inward=armAngle>0?T.MathUtils.clamp(reachAngle-Math.PI/3,0,Math.PI/3):0;
   armOut.setFromAxisAngle(forward,-Math.max(armAngle*lift,inward));
   for(const row of mapped){
    row.source.getWorldQuaternion(world).multiply(row.correction).normalize();
    // Apply the same world-space offset down the arm chain so children retain
    // the original elbow/wrist articulation instead of cancelling the shoulder.
    if(['L_upperArm','L_forearm','L_hand'].includes(row.bone.name))world.premultiply(armOut);
    row.bone.parent!.getWorldQuaternion(parent).invert();
    row.bone.quaternion.copy(parent.multiply(world)).normalize();
    // Left arm is +X; positive Z leans the head toward -X. Blend out as it lowers.
    if(row.bone.name==='head')row.bone.quaternion.premultiply(lean).normalize();
    // Quaternion hemisphere continuity prevents redundant sign flips in exports.
    const values=row.values,n=values.length;
    if(n&&row.bone.quaternion.dot(new T.Quaternion().fromArray(values,n-4))<0){const q=row.bone.quaternion;q.set(-q.x,-q.y,-q.z,-q.w);}
    row.bone.quaternion.toArray(values,n);row.bone.updateWorldMatrix(false,true);
   }
   hip.source.getWorldPosition(v).sub(sourceHip).multiplyScalar(ratio).add(targetHip).toArray(positions,positions.length);
  }
 }finally{
  mixer.stopAllAction();mixer.uncacheRoot(source);
  for(const {bone,p,q,s} of [...saved,...sourceSaved]){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}
  source.updateMatrixWorld(true);
  rig.mesh.updateWorldMatrix(true,true);rig.skeleton.update();
 }
 return new T.AnimationClip('HappyWave',clip.duration,[
  ...mapped.map(row=>new T.QuaternionKeyframeTrack(`${row.bone.name}.quaternion`,times,row.values)),
  new T.VectorKeyframeTrack('hips.position',times,positions),
  ...fingerTracks,
 ]);
}
