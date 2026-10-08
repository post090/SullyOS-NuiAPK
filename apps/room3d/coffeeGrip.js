import * as T from 'three';

// The mug's handle faces +X. In this rig +Z points toward the thumb,
// and -Y is the palm: keep the rim toward the thumb and the cup outside the fist.
const mugInHand=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(
 new T.Vector3(0,1,0),new T.Vector3(0,0,1),new T.Vector3(1,0,0)));
export const COFFEE_HANDLE_GRIP=new T.Vector3(.132,0,0);
export function coffeeGrip(resident,rig){
 resident.updateWorldMatrix(true,true);
 const hand=rig.bones.L_hand,index=rig.bones.L_index_tip,middle=rig.bones.L_middle_tip;
 const point=index.getWorldPosition(new T.Vector3()).lerp(middle.getWorldPosition(new T.Vector3()),.5);
 const quaternion=resident.getWorldQuaternion(new T.Quaternion()).invert()
  .multiply(hand.getWorldQuaternion(new T.Quaternion())).multiply(mugInHand);
 return {point:resident.worldToLocal(point),quaternion};
}
