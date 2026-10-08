import * as T from 'three';

/** Split capture-space pelvis yaw from its lean. Blend yaw exactly once at the
 * navigation root; blending the root and pelvis independently can make a full
 * turn even when the final physical heading equals the starting heading. */
export function splitMotionHeading(hips:T.Quaternion){
 const forward=new T.Vector3(0,0,1).applyQuaternion(hips);
 let yaw:number;
 if(Math.hypot(forward.x,forward.z)>1e-5)yaw=Math.atan2(forward.x,forward.z);
 else{const right=new T.Vector3(1,0,0).applyQuaternion(hips);yaw=Math.atan2(-right.z,right.x);}
 const heading=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
 return {heading,lean:heading.clone().invert().multiply(hips)};
}
