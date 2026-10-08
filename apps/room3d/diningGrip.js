import * as T from 'three';
import {furniturePalm} from './chibi/furnitureMotion';
// Spoon origin is the palm grip; local +Z runs from handle to spoon tip.
export function diningGrip(resident,rig){
 resident.updateWorldMatrix(true,true);
 const hand=rig.bones.L_hand;
 const position=resident.worldToLocal(hand.localToWorld(furniturePalm('L'))).toArray();
 const rotation=resident.getWorldQuaternion(new T.Quaternion()).invert().multiply(hand.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2));
 return {position,rotation};
}
