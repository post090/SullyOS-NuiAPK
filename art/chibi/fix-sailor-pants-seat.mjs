// Export post-process: shallow rear crotch clearance without changing UVs/weights.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {Matrix3,Vector3} from 'three';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function deform(x,y,z){const w=smooth((y-2.10)/.16)*smooth((.18-Math.abs(x))/.09)*smooth((.04-z)/.08)*(1-smooth((y-2.38)/.06));return [x,y,z-Math.max(0,z+.22)*w];}
for(const path of process.argv.slice(2)){
 const file=await fs.readFile(path),jl=file.readUInt32LE(12),j=JSON.parse(file.subarray(20,20+jl)),bin=Buffer.from(file.subarray(28+jl));
 if(j.asset.extras?.sullyPantsSeat==='2026-09-20'){console.log(path,'already corrected');continue;}
 const accessor=id=>{const a=j.accessors[id],v=j.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;assert.equal(a.componentType,5126);return {a,read:i=>[0,1,2].map(k=>bin.readFloatLE(start+i*stride+k*4)),write:(i,p)=>p.forEach((v,k)=>bin.writeFloatLE(v,start+i*stride+k*4))};};
 let count=0;const seen=new Set();
 for(const node of j.nodes.filter(n=>n.name.startsWith('Sailor_pants')))for(const prim of j.meshes[node.mesh].primitives){
  const id=prim.attributes.POSITION;if(seen.has(id))continue;seen.add(id);const p=accessor(id),n=accessor(prim.attributes.NORMAL),min=[Infinity,Infinity,Infinity],max=min.map(v=>-v);
  for(let i=0;i<p.a.count;i++){const a=p.read(i),b=deform(...a);if(Math.abs(a[2]-b[2])>1e-8){count++;p.write(i,b);
    const d=a.map((_,k)=>{const l=[...a],r=[...a];l[k]-=.00001;r[k]+=.00001;return (deform(...r)[2]-deform(...l)[2])/.00002;});
    // A fully flattened rear patch has zero depth derivative; use its limiting normal.
    const matrix=new Matrix3().set(1,0,0,0,1,0,d[0],d[1],Math.max(.001,d[2])).invert().transpose();const normal=new Vector3(...n.read(i)).applyMatrix3(matrix).normalize();n.write(i,normal.toArray());
   }b.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
  }p.a.min=min;p.a.max=max;
 }
 assert.ok(count>0,'No pants geometry changed');j.asset.extras={...j.asset.extras,sullyPantsSeat:'2026-09-20'};
 const text=Buffer.from(JSON.stringify(j)),length=Math.ceil(text.length/4)*4,out=Buffer.alloc(28+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+length);text.copy(out,20);out.writeUInt32LE(bin.length,20+length);out.writeUInt32LE(0x004e4942,24+length);bin.copy(out,28+length);await fs.writeFile(path,out);console.log(path,count,'vertices');
}
