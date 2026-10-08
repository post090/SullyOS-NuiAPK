import * as T from 'three';
import type {bindBlankBody} from '../../apps/room3d/chibi/blankRig';

/** Swing/twist decomposition: only rotation around the bind forearm axis. */
export function extractTwist(rotation:T.Quaternion,axis:T.Vector3){
 const projection=axis.x*rotation.x+axis.y*rotation.y+axis.z*rotation.z;
 const twist=new T.Quaternion(axis.x*projection,axis.y*projection,axis.z*projection,rotation.w);
 if(twist.lengthSq()<1e-12)return twist.identity();
 twist.normalize();if(twist.w<0)twist.set(-twist.x,-twist.y,-twist.z,-twist.w);
 return twist;
}
export function constrainForearmTwist(rig:ReturnType<typeof bindBlankBody>,pose:Record<string,T.Quaternion>,side:'L'|'R'){
 const axis=rig.bones[`${side}_hand`].position.clone().normalize();
 const twist=extractTwist(pose[`${side}_hand`],axis);
 pose[`${side}_twist1`]?.identity().slerp(twist,.25);
 pose[`${side}_twist2`]?.identity().slerp(twist,.50);
 pose[`${side}_twist3`]?.identity().slerp(twist,.75);
}
/** Signed rotation about axis that brings a direction nearest to target. */
export function aimTwist(direction:T.Vector3,axis:T.Vector3,target:T.Vector3){
 const from=direction.clone().addScaledVector(axis,-direction.dot(axis)).normalize();
 const to=target.clone().addScaledVector(axis,-target.dot(axis)).normalize();
 return Math.atan2(axis.dot(from.clone().cross(to)),from.dot(to));
}
