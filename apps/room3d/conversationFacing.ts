import {Euler,Quaternion,Vector3,type Object3D} from 'three';
export function conversationHeading(root:Object3D,target:Vector3,weight:number){
 const p=root.getWorldPosition(new Vector3()),dx=target.x-p.x,dz=target.z-p.z;
 if(Math.hypot(dx,dz)<.01)return;
 const desired=new Quaternion().setFromEuler(new Euler(0,Math.atan2(dx,dz),0,'YXZ'));
 if(root.parent)desired.premultiply(root.parent.getWorldQuaternion(new Quaternion()).invert());
 root.quaternion.slerp(desired,Math.max(0,Math.min(1,weight)));
}
export function conversationHead(head:Object3D,target:Vector3,weight:number){
 if(!head.parent)return;
 head.parent.updateWorldMatrix(true,false);
 const direction=head.parent.worldToLocal(target.clone()).sub(head.position);
 const yaw=Math.max(-1.05,Math.min(1.05,Math.atan2(direction.x,direction.z)));
 const pitch=Math.max(-.3,Math.min(.3,-Math.atan2(direction.y,Math.hypot(direction.x,direction.z))));
 const desired=new Quaternion().setFromEuler(new Euler(pitch,yaw,0,'YXZ'));
 head.quaternion.slerp(desired,Math.max(0,Math.min(1,weight)));
}
