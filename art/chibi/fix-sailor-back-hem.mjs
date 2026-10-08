// Geometry-only correction; retain original UVs, paint, skin weights and topology.
// Usage: pnpm node art/chibi/fix-sailor-back-hem.mjs [GLB paths...]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const derivative=t=>t>0&&t<1?6*t*(1-t):0;
export function backHem(x,y,z){
 const h=(2.92-y)/.52,b=(-z-.025)/.175;
 const shift=.085*smooth(h)*smooth(b);
 return {position:[x,y,z-shift],dy:.085*derivative(h)/.52*smooth(b),dz:1+.085*smooth(h)*derivative(b)/.175};
}
export async function correct(path){
 const bytes=await fs.readFile(path),jsonLength=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jsonLength)),binOffset=28+jsonLength,bin=Buffer.from(bytes.subarray(binOffset));
 if(j.asset.extras?.sullyBackHem==='2026-09-20')return {path,alreadyCorrected:true};
 const touched=new Set(),report={path,vertices:0,maxShift:0};
 function accessor(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');const stride=v.byteStride??12,start=(v.byteOffset??0)+(a.byteOffset??0);return {a,read:i=>[0,1,2].map(k=>bin.readFloatLE(start+i*stride+k*4)),write:(i,p)=>p.forEach((v,k)=>bin.writeFloatLE(v,start+i*stride+k*4))};}
 for(const node of j.nodes.filter(n=>n.name==='Sailor_top'))for(const primitive of j.meshes[node.mesh].primitives){
  const pid=primitive.attributes.POSITION;if(touched.has(pid))continue;touched.add(pid);
  const p=accessor(pid),n=accessor(primitive.attributes.NORMAL),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.a.count;i++){
   const v=p.read(i),result=backHem(...v),shift=v[2]-result.position[2];
   if(shift>1e-8){p.write(i,result.position);report.vertices++;report.maxShift=Math.max(report.maxShift,shift);
    const normal=n.read(i),nz=normal[2]/result.dz,ny=normal[1]-nz*result.dy,length=Math.hypot(normal[0],ny,nz);n.write(i,[normal[0]/length,ny/length,nz/length]);
   }
   result.position.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
  }p.a.min=min;p.a.max=max;
 }
 assert.ok(touched.size,'Sailor_top mesh missing');j.asset.extras={...j.asset.extras,sullyBackHem:'2026-09-20'};
 const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,out=Buffer.alloc(28+length+bin.length,0);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+length);json.copy(out,20);out.writeUInt32LE(bin.length,20+length);out.writeUInt32LE(0x004e4942,24+length);bin.copy(out,28+length);await fs.writeFile(path,out);return report;
}
for(const path of process.argv.slice(2))console.log(await correct(path));
