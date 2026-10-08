import * as T from 'three';
import {CCDIKSolver} from 'three/examples/jsm/animation/CCDIKSolver.js';
import {BLANK_SCALE} from './blankBody';
import {bodyHeightY} from './bodyHeight';
import {approvedGarments} from './approvedWardrobe';
import {constrainForearmTwist} from '../../../experiments/chibi/forearmTwist';
import type {bindBlankBody} from './blankRig';

export const MIRROR_GROOM_SECONDS=8.8;
const smooth=T.MathUtils.smootherstep;
/** Authored pose-to-pose timing. Contact strokes pause before the next gesture. */
export function mirrorGroomFrame(seconds:number){
 const t=T.MathUtils.clamp(Number.isFinite(seconds)?seconds:0,0,MIRROR_GROOM_SECONDS);
 const hem=smooth(t,.7,1.3)*(1-smooth(t,2.8,3.3));
 const brush=smooth(t,3.4,4.05)*(1-smooth(t,5.2,5.85));
 const check=smooth(t,5.8,6.5)*(1-smooth(t,7.9,8.8));
 return {hem,brush,check,stroke:smooth(t,1.5,2.5),sweep:smooth(t,4.15,5.15),
  nod:.13*smooth(t,.2,.65)*(1-smooth(t,5.4,6.2))-.025*check,
  yaw:.13*check,tilt:-.055*check,
  phase:t<.7?'look':t<3.3?'hem':t<5.85?'smooth':t<7.9?'check':'rest'};
}

/** Reuse Three CCD IK; two virtual wrist targets never join the shipped skin. */
export function createMirrorGrooming(rig:ReturnType<typeof bindBlankBody>,body:T.Group){
 const targets=[new T.Bone(),new T.Bone()],bones=[...rig.skeleton.bones,...targets];
 const index=(n:string)=>bones.indexOf(rig.bones[n]);
 const chains=['L','R'].map((side,i)=>({target:rig.skeleton.bones.length+i,effector:index(side+'_hand'),iteration:28,maxAngle:.15,links:[{index:index(side+'_forearm')},{index:index(side+'_upperArm')}]}));
 const solver=new CCDIKSolver({skeleton:{bones}} as T.SkinnedMesh,chains),point=new T.Vector3(),base=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion(),chestQ=new T.Quaternion();
 const up=new T.Vector3(0,1,0),forward=new T.Vector3(0,0,1),rest=new T.Vector3(),bodyInverse=new T.Matrix4();
 const pose=Object.fromEntries(Object.keys(rig.bones).map(n=>[n,new T.Quaternion()]));
 const eligible=(o:T.Object3D)=>o instanceof T.SkinnedMesh&&(o.name==='hoodie-top'||approvedGarments.some(g=>g.id===o.userData.garmentId&&['top','outer','onepiece'].includes(g.slot)));
 let cachedMeshes:T.SkinnedMesh[]=[],anchors:{mesh:T.SkinnedMesh;index:number;rest:T.Vector3}[][]=[[],[],[]];
 function refresh(){
  const meshes=body.children.filter(eligible) as T.SkinnedMesh[];
  if(meshes.length===cachedMeshes.length&&meshes.every((m,i)=>m===cachedMeshes[i]))return;
  cachedMeshes=meshes;anchors=[[],[],[]];
  // Use front torso vertices from the clothes actually being worn. Keep long
  // coats within hand reach, and never treat a sleeve or skirt as the hem target.
  const desired=[new T.Vector3(.11*BLANK_SCALE,bodyHeightY(.40*BLANK_SCALE,rig.bodyHeight),.10*BLANK_SCALE),new T.Vector3(-.11*BLANK_SCALE,bodyHeightY(.40*BLANK_SCALE,rig.bodyHeight),.10*BLANK_SCALE),new T.Vector3(-.055*BLANK_SCALE,bodyHeightY(.515*BLANK_SCALE,rig.bodyHeight),.10*BLANK_SCALE)];
  for(let k=0;k<3;k++)for(const mesh of meshes){
   const p=mesh.geometry.attributes.position;let best=-1,score=Infinity;
   for(let i=0;i<p.count;i++){
    rest.fromBufferAttribute(p,i);if(Math.abs(rest.x)>.18*BLANK_SCALE||rest.z<.025*BLANK_SCALE)continue;
    const d=(rest.x-desired[k].x)**2+(rest.y-desired[k].y)**2;
    if(d<score){score=d;best=i;}
   }
   if(best>=0)anchors[k].push({mesh,index:best,rest:new T.Vector3().fromBufferAttribute(p,best)});
  }
 }
 function at(k:number,fallback:T.Vector3){
  base.copy(fallback);let front=-Infinity;
  for(const a of anchors[k]){
   // bindMode inverse matrices must follow the current scene transform first.
   point.copy(a.rest);a.mesh.applyBoneTransform(a.index,point);point.applyMatrix4(a.mesh.matrixWorld).applyMatrix4(bodyInverse);
   if(point.z>front){front=point.z;base.copy(point);}
  }
  return base;
 }
 return (time:number)=>{
  const frame=mirrorGroomFrame(time);if(frame.hem===0&&frame.brush===0)return;
  refresh();body.updateWorldMatrix(true,true);body.updateMatrixWorld(true);rig.skeleton.update();bodyInverse.copy(body.matrixWorld).invert();
  rig.bones.chest.getWorldQuaternion(chestQ);
  for(const [i,side,sign]of [[0,'L',1],[1,'R',-1]] as const){
   const weight=i===1?Math.max(frame.hem,frame.brush):frame.hem;if(!weight)continue;
   const brushing=i===1&&frame.brush>frame.hem;
   const destination=at(brushing?2:i,new T.Vector3(sign*.11*BLANK_SCALE,bodyHeightY((brushing?.515:.40)*BLANK_SCALE,rig.bodyHeight),.11*BLANK_SCALE)).clone();
   destination.y+=(brushing?.10-.08*frame.sweep:.045-.015*frame.stroke)*BLANK_SCALE;
   destination.x+=sign*(brushing?.02:.03)*BLANK_SCALE;
   destination.z+=(brushing?.05:.03+.008*Math.sin(frame.stroke*Math.PI))*BLANK_SCALE;
   body.localToWorld(destination);targets[i].matrixWorld.makeTranslation(destination.x,destination.y,destination.z);solver.updateOne(chains[i],weight);
   // Blend toward fingers down without forcing a full wrist flip. Contact stays in front
   // of the fabric; do not pull on the actual vertices or alter outfit fits.
   q.setFromAxisAngle(up,Math.PI).multiply(new T.Quaternion().setFromAxisAngle(forward,-sign*Math.PI/2));
   q.premultiply(chestQ);rig.bones[side+'_hand'].parent!.getWorldQuaternion(parentQ);
   rig.bones[side+'_hand'].quaternion.slerp(parentQ.invert().multiply(q),weight*.4);
   rig.setHandCurl(side,.12+.13*frame.hem);
   for(const [name,bone]of Object.entries(rig.bones))pose[name].copy(bone.quaternion);
   constrainForearmTwist(rig,pose,side);for(const suffix of ['twist1','twist2','twist3'])rig.bones[side+'_'+suffix]?.quaternion.copy(pose[side+'_'+suffix]);
   body.updateWorldMatrix(true,true);
  }
 };
}
