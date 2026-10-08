// A small dead band prevents flicker when the camera is parallel to a wall.
export function automaticWallVisible(edge,dx,dz,previous=true){
 if(edge==='front')return false;
 const length=Math.hypot(dx,dz)||1;
 const facing=({left:-dx,right:dx,front:dz,back:-dz})[edge]/length;
 return facing>.08?false:facing<-.08?true:previous;
}
