// Patch the distributed kit when the original .blend is unavailable.
// The exporter also omits these objects on future Blender exports.
import fs from 'node:fs';
const path='public/room3d/kit.glb',file=fs.readFileSync(path);
const jsonLength=file.readUInt32LE(12),json=JSON.parse(file.subarray(20,20+jsonLength).toString());
const binStart=28+jsonLength,bin=file.subarray(binStart,binStart+file.readUInt32LE(20+jsonLength));
const chunks=[bin];let byteLength=bin.length,removed=0;
function read(accessor,index,axis=0){
 const a=json.accessors[accessor],v=json.bufferViews[a.bufferView],components=a.type==='VEC3'?3:1;
 const bytes=a.componentType===5126||a.componentType===5125?4:2;
 const offset=(v.byteOffset||0)+(a.byteOffset||0)+index*(v.byteStride||components*bytes)+axis*bytes;
 return a.componentType===5126?bin.readFloatLE(offset):bytes===4?bin.readUInt32LE(offset):bin.readUInt16LE(offset);
}
for(const node of json.nodes){
 if(!['shell_cream_right','shell_lavender_right','shell_lavender_floor'].includes(node.name))continue;
 for(const p of json.meshes[node.mesh].primitives){
  const keep=[],a=json.accessors[p.indices];let count=0;
  for(let i=0;i<a.count;i+=3){
   const ids=[0,1,2].map(k=>read(p.indices,i+k));
   const entry=ids.every(id=>{const [x,y,z]=[0,1,2].map(k=>read(p.attributes.POSITION,id,k)+(node.translation?.[k]||0));return node.name.endsWith('_right')?z>.4:y>.08&&y<1.2&&z>2.3&&Math.abs(x)>2.7;});
   if(entry)count++;else keep.push(...ids);
  }
  if(!count)continue;
  const buffer=Buffer.alloc(keep.length*4);keep.forEach((id,i)=>buffer.writeUInt32LE(id,i*4));
  const view=json.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:buffer.length,target:34963})-1;
  p.indices=json.accessors.push({bufferView:view,componentType:5125,count:keep.length,type:'SCALAR',min:[Math.min(...keep)],max:[Math.max(...keep)]})-1;
  chunks.push(buffer);byteLength+=buffer.length;removed+=count;
  console.log(node.name,': removed',count,'triangles');
 }
}
if(removed){
 json.buffers[0].byteLength=byteLength;const encoded=Buffer.from(JSON.stringify(json));
 const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+byteLength,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(byteLength);binHeader.writeUInt32LE(0x004e4942,4);
 fs.writeFileSync(path,Buffer.concat([header,padded,binHeader,...chunks]));
}
console.log('Removed entry triangles:',removed);
