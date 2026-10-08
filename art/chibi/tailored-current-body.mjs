import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as T from 'three';
import {surfaceBinding} from './clothing-details.mjs';

// Snapshot exported from createBlankBody/bindBlankBody, the actual wardrobe
// body. The earlier sailor GLB body is an older, substantially thinner mesh.
export async function reference(){
 const bytes=await fs.readFile('output/clothing-rebuild-0920/wardrobe-current-body.glb');
 const root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 root.updateMatrixWorld(true);return root;
}

// The authored sewing pattern began on the narrower fitting-workbench body.
// Move arm sections by the same named-joint bind-position offsets used by the
// wardrobe loader, and fit the actual thicker torso/arms before publication.
export function fitCurrentUpper(mesh,body){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const binding=body?surfaceBinding(body):null;
 for(let i=0;i<p.count;i++){
  let dx=0;for(let k=0;k<4;k++){const name=mesh.skeleton.bones[si.getComponent(i,k)].name,w=sw.getComponent(i,k),s=name[0]==='L'?1:-1;if(name.endsWith('_upperArm'))dx+=s*.08*w;else if(/_(forearm|hand|twist[123])$/.test(name))dx+=s*.22*w;}
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),torso=1-T.MathUtils.smoothstep(Math.abs(x),.30,.64),neck=1-T.MathUtils.smoothstep(y,3.28,3.405),factor=1+.15*neck+.15*torso*neck;
  const ax=Math.abs(x),shoulder=T.MathUtils.smoothstep(ax,.20,.38)*(1-T.MathUtils.smoothstep(ax,.62,.80))*T.MathUtils.smoothstep(y,3.12,3.30);
  const elbow=T.MathUtils.smoothstep(ax,.65,.80)*(1-T.MathUtils.smoothstep(ax,1.05,1.18));
  const shoulderRoom=.18*T.MathUtils.smoothstep(ax,.20,.32)*(1-T.MathUtils.smoothstep(ax,.58,.74))*T.MathUtils.smoothstep(y,2.95,3.10)*(1-T.MathUtils.smoothstep(y,3.32,3.40));
  p.setXYZ(i,x+dx,3.125+(y-3.125)*(1+.15*elbow+shoulderRoom)+.055*shoulder,.045+(z-.045)*(factor+.14*elbow+shoulderRoom));
  if(binding&&ax>.61){
   const point=new T.Vector3().fromBufferAttribute(p,i),axis=new T.Vector3(point.x,3.125,.03),dir=point.clone().sub(axis).normalize();
   const hit=binding.cast(axis,dir,.45);
   if(hit){const weights=binding.weights(hit),armOnly=weights.every(([j,w])=>w<1e-6||/_(upperArm|forearm|hand|twist[123])$/.test(mesh.skeleton.bones[j].name));if(armOnly)for(let k=0;k<4;k++){si.setComponent(i,k,weights[k][0]);sw.setComponent(i,k,weights[k][1]);}}
  }
  if(n){const v=new T.Vector3(n.getX(i),n.getY(i),n.getZ(i)/factor).normalize();n.setXYZ(i,v.x,v.y,v.z);}
 }
}
