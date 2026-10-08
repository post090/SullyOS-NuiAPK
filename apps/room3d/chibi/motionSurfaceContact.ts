import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import type {bindBlankBody} from './blankRig';

/** Minimal contact correction: keep lifted feet, only lift feet below the support. */
export function createMotionSurfaceContact(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const targets=[new T.Bone(),new T.Bone()],bones=[...rig.skeleton.bones,...targets];
 const index=(name:string)=>bones.indexOf(rig.bones[name]);
 const chains=['L','R'].map((side,i)=>({target:rig.skeleton.bones.length+i,effector:index(side+'_foot'),iteration:30,maxAngle:.15,links:[{index:index(side+'_shin')},{index:index(side+'_thigh')}]}));
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains),point=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion();
 return (height:number)=>{
  body.updateWorldMatrix(true,true);body.updateMatrix();
  for(let i=0;i<2;i++){
   const foot=rig.bones[i===0?'L_foot':'R_foot'];body.worldToLocal(foot.getWorldPosition(point));point.applyMatrix4(body.matrix);
   if(point.y>=height)continue;
   foot.getWorldQuaternion(q);point.y=height;
   point.applyMatrix4(body.matrix.clone().invert());body.localToWorld(point);
   targets[i].matrixWorld.makeTranslation(point.x,point.y,point.z);solver.updateOne(chains[i]);
   foot.parent!.getWorldQuaternion(parentQ);foot.quaternion.copy(parentQ.invert().multiply(q));foot.updateWorldMatrix(false,true);
  }
 };
}
