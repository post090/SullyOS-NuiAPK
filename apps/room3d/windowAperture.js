import * as T from 'three';

export const isWindowPane=material=>['glass','window-blue'].includes(material.name);
// Derive the opening from the authored pane after asset normalization. Never
// guess a hole from curtains/sills or alter the user's furniture placement.
export function inferWindowAperture(root){
 root.updateWorldMatrix(true,true);const bounds=new T.Box3(),part=new T.Box3();
 root.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).every(isWindowPane)){o.geometry.computeBoundingBox();part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);bounds.union(part);}});
 if(bounds.isEmpty())return null;
 return {width:bounds.max.x-bounds.min.x,bottom:bounds.min.y,top:bounds.max.y,offset:(bounds.min.x+bounds.max.x)/2};
}

export function windowSunPose(source,phase){
 const a=source.item.rotation*Math.PI/180,n=[Math.sin(a),Math.cos(a)],side=phase==='sunset'?.48:.32,down=phase==='sunset'?.72:.95;
 const ray=[n[0]-n[1]*side,-down,n[1]+n[0]*side],target=source.position;
 return {position:target.map((v,i)=>v-ray[i]*10),target:[...target]};
}
