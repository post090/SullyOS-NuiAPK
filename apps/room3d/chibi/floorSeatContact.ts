import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import {BLANK_SCALE} from './blankBody';
import type {bindBlankBody} from './blankRig';

// Reuse Three's CCD solver; virtual targets do not change the shipped 48-bone
// skeleton, skin indices, bone lengths, or wardrobe bindings.
export function createFloorSeatContact(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const names=['L_foot','R_foot','R_hand'],points=names.map(()=>new T.Bone());
 const hips=['L','R'].map(prefix=>rig.bones[prefix+'_thigh'].position.clone().add(rig.bones.hips.position));
 const bones=[...rig.skeleton.bones,...points],index=(name:string)=>bones.indexOf(rig.bones[name]);
 const chains=names.map((name,i)=>({target:rig.skeleton.bones.length+i,effector:index(name),iteration:24,maxAngle:.18,links:name.endsWith('foot')?[
  {index:index(name[0]+'_shin'),rotationMin:new T.Vector3(.02,0,0),rotationMax:new T.Vector3(2.65,0,0)},
  {index:index(name[0]+'_thigh'),rotationMin:new T.Vector3(-1.7,0,-.04),rotationMax:new T.Vector3(.25,0,.04)},
 ]:[{index:index('R_forearm')},{index:index('R_upperArm')}]}));
 // CCDIKSolver only needs this skeleton view; keep helper targets out of skinning.
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains);
 const target=new T.Vector3(),current=new T.Vector3(),q=new T.Quaternion(),bodyQ=new T.Quaternion();
 return (height:number,weight:number,fold:number,support:number,shoeLift:number)=>{
  body.updateWorldMatrix(true,true);body.getWorldQuaternion(bodyQ);
  for(let i=0;i<2;i++){
   const foot=rig.bones[names[i]],prefix=i===0?'L':'R',hip=hips[i];
   body.worldToLocal(foot.getWorldPosition(current));
   const y=-body.position.y-height*weight+.049*BLANK_SCALE+shoeLift;
   const length=rig.bones[prefix+'_shin'].position.length()+foot.position.length();
   // Adapt reach to leg length and seat height; never stretch the bones to reach
   // a fixed forward marker. Keep a little bend instead of locking the knees.
   const reach=Math.sqrt(Math.max(0,(length*.97)**2-(hip.y-y)**2))*.92;
   target.set(hip.x,y,hip.z+reach);
   target.x=T.MathUtils.lerp(current.x,target.x,fold);target.z=T.MathUtils.lerp(current.z,target.z,fold);
   body.localToWorld(target);points[i].matrixWorld.makeTranslation(target.x,target.y,target.z);
   solver.updateOne(chains[i],T.MathUtils.smoothstep(weight,0,.2));
   // Keep the shoe's authored sole level rather than pointing it through the floor.
   foot.parent!.getWorldQuaternion(q).invert().multiply(bodyQ);
   foot.quaternion.slerp(q,T.MathUtils.smoothstep(weight,0,.2));foot.updateWorldMatrix(false,true);
  }
  if(support>0){
   target.set(-.145*BLANK_SCALE,-body.position.y+height*(1-weight)+.02*BLANK_SCALE,-.015*BLANK_SCALE);
   body.localToWorld(target);points[2].matrixWorld.makeTranslation(target.x,target.y,target.z);
   solver.updateOne(chains[2],support);
  }
 };
}
