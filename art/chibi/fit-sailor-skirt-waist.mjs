// Fit the outside skirt shell to the actual body cross-section. Keep paint and rig data.
// Usage: pnpm node art/chibi/fit-sailor-skirt-waist.mjs [skirt GLBs...]
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as T from 'three';
function parse(bytes){const length=bytes.readUInt32LE(12);return {j:JSON.parse(bytes.subarray(20,20+length)),bin:Buffer.from(bytes.subarray(28+length))};}
function accessor(asset,id){const a=asset.j.accessors[id],v=asset.j.bufferViews[a.bufferView],size=a.type==='VEC3'?3:1,bytes=a.componentType===5123?2:4,start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??size*bytes;return {a,read:i=>Array.from({length:size},(_,k)=>a.componentType===5126?asset.bin.readFloatLE(start+i*stride+k*bytes):bytes===2?asset.bin.readUInt16LE(start+i*stride+k*bytes):asset.bin.readUInt32LE(start+i*stride+k*bytes)),write:(i,p)=>p.forEach((v,k)=>asset.bin.writeFloatLE(v,start+i*stride+k*4))};}
const reference=parse(await fs.readFile('output/cardigan-controller/sailor-girl.glb')),node=reference.j.nodes.find(n=>n.name==='Mesh_0'),primitive=reference.j.meshes[node.mesh].primitives[0],bp=accessor(reference,primitive.attributes.POSITION),bi=accessor(reference,primitive.indices),bodyGeometry=new T.BufferGeometry();
bodyGeometry.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:bp.a.count},(_,i)=>bp.read(i)).flat(),3));bodyGeometry.setIndex(Array.from({length:bi.a.count},(_,i)=>bi.read(i)[0]));const body=new T.Mesh(bodyGeometry,new T.MeshBasicMaterial({side:T.DoubleSide}));body.updateMatrixWorld();const ray=new T.Raycaster();
const smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
function deform(x,y,z){
 const weight=smooth((y-2.15)/.16),center=.015,dx=x,dz=z-center,r=Math.hypot(dx,dz);if(!weight||r<.001)return [x,y,z];
 ray.set(new T.Vector3(0,y,center),new T.Vector3(dx/r,0,dz/r));ray.far=.8;
 const hit=ray.intersectObject(body,false)[0];if(!hit)return [x,y,z];
 // Margin accounts for polygon chords between waist vertices, not just point clearance.
 const expand=Math.max(0,hit.distance+.040-r)*weight,scale=(r+expand)/r;
 return [dx*scale,y,center+dz*scale];
}
for(const path of process.argv.slice(2)){
 const asset=parse(await fs.readFile(path)),{j,bin}=asset;if(j.asset.extras?.sullySkirtWaist==='2026-09-20'){console.log(path,'already fitted');continue;}
 const skirt=j.nodes.find(n=>n.name==='Sailor_skirt');assert.ok(skirt,'Missing skirt');
 // Primitive zero is the pleated outer shell; the shorts lining stays unchanged.
 const prim=j.meshes[skirt.mesh].primitives[0],p=accessor(asset,prim.attributes.POSITION),n=accessor(asset,prim.attributes.NORMAL);let changed=0,maxMove=0;const min=[Infinity,Infinity,Infinity],max=min.map(v=>-v);
 for(let i=0;i<p.a.count;i++){const a=p.read(i),b=deform(...a),distance=Math.hypot(...b.map((v,k)=>v-a[k]));
  if(distance>1e-7){changed++;maxMove=Math.max(maxMove,distance);p.write(i,b);
   const columns=[0,1,2].map(k=>{const l=[...a],r=[...a];l[k]-=.0001;r[k]+=.0001;const low=deform(...l),high=deform(...r);return high.map((v,i)=>(v-low[i])/.0002);});
   const m=new T.Matrix3().set(...[0,1,2].flatMap(r=>columns.map(c=>c[r]))).invert().transpose();const normal=new T.Vector3(...n.read(i)).applyMatrix3(m).normalize();assert.ok(normal.length()>.9);n.write(i,normal.toArray());
  }b.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
 }p.a.min=min;p.a.max=max;j.asset.extras={...j.asset.extras,sullySkirtWaist:'2026-09-20'};
 const text=Buffer.from(JSON.stringify(j)),length=Math.ceil(text.length/4)*4,out=Buffer.alloc(28+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+length);text.copy(out,20);out.writeUInt32LE(bin.length,20+length);out.writeUInt32LE(0x004e4942,24+length);bin.copy(out,28+length);await fs.writeFile(path,out);console.log({path,changed,maxMove});
}
