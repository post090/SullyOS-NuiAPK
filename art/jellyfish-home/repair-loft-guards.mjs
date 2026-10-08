// Add the missing side guards without re-exporting or changing other kit assets.
// build.py carries the matching source geometry for future Blender rebuilds.
import fs from 'node:fs';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const path='public/room3d/kit.glb',file=fs.readFileSync(path),jsonLength=file.readUInt32LE(12),json=JSON.parse(file.subarray(20,20+jsonLength));
const root=json.nodes.find(n=>n.extras?.assetId==='loft');if(!root)throw Error('Missing loft asset');
if(root.extras.loftSideGuards===1){console.log('Loft side guards already installed');process.exit(0);}
const bin=file.subarray(28+jsonLength,28+jsonLength+file.readUInt32LE(20+jsonLength)),chunks=[bin];let length=bin.length,triangles=0;
function attribute(array,type){
 const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=json.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length,target:34962})-1;chunks.push(bytes);length+=bytes.length;
 const accessor={bufferView:view,componentType:5126,count:array.length/3,type};
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++) {const axis=i%3;min[axis]=Math.min(min[axis],array[i]);max[axis]=Math.max(max[axis],array[i]);}Object.assign(accessor,{min,max});
 return json.accessors.push(accessor)-1;
}
for(const cap of [false,true]){
 const parts=[[-.20,1.28,1.96],[-2.36,1.595,1.33]].map(([x,y,span])=>{
  const g=new RoundedBoxGeometry(cap?.15:.12,cap?.10:.55,span+(cap?.02:0),1,cap?.035:.025);
  g.translate(x+1.5075,(cap?3:2.70)-.14,-y+.3325);return g;
 });
 const g=mergeGeometries(parts),material=json.materials.findIndex(m=>m.name===(cap?'woodLight':'cream'));if(material<0)throw Error('Missing guard material');
 const mesh=json.meshes.push({name:cap?'loft_side_guard_caps':'loft_side_guards',primitives:[{attributes:{POSITION:attribute(g.attributes.position.array,'VEC3'),NORMAL:attribute(g.attributes.normal.array,'VEC3')},material,mode:4}]})-1;
 root.children.push(json.nodes.push({name:cap?'loft_side_guard_caps':'loft_side_guards',mesh})-1);triangles+=g.attributes.position.count/3;g.dispose();parts.forEach(p=>p.dispose());
}
root.extras.loftSideGuards=1;json.buffers[0].byteLength=length;
const encoded=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(length);binHeader.writeUInt32LE(0x004e4942,4);fs.writeFileSync(path,Buffer.concat([header,padded,binHeader,...chunks]));console.log({addedTriangles:triangles,addedDrawGroups:2});
