import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export async function sailorCuffSource(){
 const b=await fs.readFile('public/room3d/wardrobe/sailor-school-user.glb'),l=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+l)),bin=b.subarray(28+l);
 j.images=[];j.textures=[];j.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],roughnessFactor:.9}}];for(const m of j.meshes)for(const p of m.primitives)p.material=0;
 const text=Buffer.from(JSON.stringify(j)),len=Math.ceil(text.length/4)*4,bytes=Buffer.alloc(28+len+bin.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(len,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.fill(32,20,20+len);text.copy(bytes,20);bytes.writeUInt32LE(bin.length,20+len);bytes.writeUInt32LE(0x004e4942,24+len);bin.copy(bytes,28+len);
 const root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;root.updateMatrixWorld(true);return root.getObjectByName('Sailor_top');
}

export async function copySailorCuffs(body){
 const source=await sailorCuffSource(),g=source.geometry,p=g.attributes.position,n=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 body.updateWorldMatrix(true,false);const target=body.skeleton.bones,remap=source.skeleton.bones.map(b=>target.findIndex(t=>t.name===b.name)),delta=source.skeleton.bones.map((b,i)=>target[remap[i]].getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())));
 const unit=w=>{const v=[...w].filter(([,x])=>x>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=v.reduce((s,[,x])=>s+x,0);return Array.from({length:4},(_,i)=>[v[i]?.[0]??0,(v[i]?.[1]??0)/sum]);};
 const vertex=i=>{const point=new T.Vector3().fromBufferAttribute(p,i),weights=new Map();for(let k=0;k<4;k++){const j=si.getComponent(i,k),v=sw.getComponent(i,k);point.addScaledVector(delta[j],v);weights.set(remap[j],(weights.get(remap[j])??0)+v);}return{p:point,n:new T.Vector3().fromBufferAttribute(n,i),w:unit(weights)};};
 const mix=(a,b,t)=>{const w=new Map();for(const[j,v]of a.w)w.set(j,(w.get(j)??0)+v*(1-t));for(const[j,v]of b.w)w.set(j,(w.get(j)??0)+v*t);return{p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),w:unit(w)};};
 const pos=[],normal=[],joints=[],weights=[];
 for(const sign of [-1,1])for(let i=0;i<g.index.count;i+=3){const poly=[0,1,2].map(k=>vertex(g.index.getX(i+k))),clipped=[];for(let k=0;k<3;k++){const a=poly[k],b=poly[(k+1)%3],da=sign*a.p.x-1.44,db=sign*b.p.x-1.44;if(da>=0)clipped.push(a);if((da>=0)!==(db>=0))clipped.push(mix(a,b,da/(da-db)));}for(let k=1;k<clipped.length-1;k++)for(const v of [clipped[0],clipped[k],clipped[k+1]]){pos.push(...v.p.toArray());normal.push(...v.n.toArray());for(const[j,w]of v.w){joints.push(j);weights.push(w);}}}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(pos,3));result.setAttribute('normal',new T.Float32BufferAttribute(normal,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));result.setIndex(Array.from({length:pos.length/3},(_,i)=>i));return result;
}
