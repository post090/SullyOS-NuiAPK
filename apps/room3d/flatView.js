import * as THREE from 'three';

// A shallow, front-biased orthographic composition, shared by every room.
export const FLAT_VIEW_DIRECTION = new THREE.Vector3(6, 8, 18).normalize();

export function fitFlatView(camera, controls, box, aspect, reset=false) {
 const bounds=box.isEmpty()?new THREE.Box3(new THREE.Vector3(-6,-.5,-5),new THREE.Vector3(6,4.8,5)):box;
 const center=bounds.getCenter(new THREE.Vector3());
 controls.target.copy(center);
 camera.position.copy(center).addScaledVector(FLAT_VIEW_DIRECTION,Math.max(30,bounds.getSize(new THREE.Vector3()).length()*2));
 camera.lookAt(center);camera.updateMatrixWorld(true);
 const projected=bounds.clone().applyMatrix4(camera.matrixWorldInverse).getSize(new THREE.Vector3());
 const height=Math.max(projected.y*1.26,projected.x*1.12/aspect,1);
 camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;
 camera.far=Math.max(200,camera.position.distanceTo(center)*4);
 camera.clearViewOffset();
 if(reset)camera.zoom=1;
 camera.updateProjectionMatrix();controls.update();
}
