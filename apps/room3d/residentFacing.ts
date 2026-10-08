import type {Object3D} from 'three';
/** Actor heading is a pure world-up yaw, never a partial edit of XYZ Euler angles. */
export function setResidentHeading(root:Object3D,yaw:number){root.rotation.set(0,yaw,0,'YXZ');}
