import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {Matrix4} from 'three';

type Accessor={bufferView:number;byteOffset?:number;componentType:number;count:number;type:string;normalized?:boolean};
type Primitive={indices:number;attributes:Record<string,number>};
type Gltf={
 accessors:Accessor[];
 bufferViews:Array<{byteOffset?:number;byteStride?:number}>;
 nodes:Array<{name?:string;mesh?:number;skin?:number}>;
 meshes:Array<{primitives:Primitive[]}>;
 skins:Array<{joints:number[];inverseBindMatrices:number}>;
};

function loadGarment(name:string){
 const bytes=readFileSync(`public/room3d/wardrobe/${name==='school-loafers'?'sailor-girl.glb':name+'-rig.glb'}`),jsonLength=bytes.readUInt32LE(12);
 const gltf:Gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),bin=bytes.subarray(28+jsonLength);
 const read=(id:number)=>{
  const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView];
  const width:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const sizes:Record<number,number>={5121:1,5123:2,5125:4,5126:4},size=sizes[a.componentType],n=width[a.type];
  if(!size||!n)throw Error(`Unsupported garment accessor ${id}`);
  const start=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??n*size;
  return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,k)=>{
   const offset=start+i*stride+k*size;
   const value=a.componentType===5126?bin.readFloatLE(offset):a.componentType===5125?bin.readUInt32LE(offset):a.componentType===5123?bin.readUInt16LE(offset):bin.readUInt8(offset);
   return a.normalized&&a.componentType!==5126?value/(2**(size*8)-1):value;
  }));
 };
 const nodes=gltf.nodes.filter(n=>n.mesh!==undefined&&n.name?.startsWith(name==='school-loafers'?'Sailor_shoes':'Lowerwear_'));
 expect(nodes.length,`${name}: published garment nodes`).toBeGreaterThan(0);
 return nodes.flatMap(node=>{
  const skin=gltf.skins[node.skin!],names=skin.joints.map(i=>gltf.nodes[i].name??'');
  const inverseBind=read(skin.inverseBindMatrices);
  // Locate knees by bone name, never by a source rig's joint array order.
  const kneeY=Math.min(...['L_shin','R_shin'].map(name=>{
   const bone=names.indexOf(name);expect(bone,`${name}: knee bone`).toBeGreaterThanOrEqual(0);
   return new Matrix4().fromArray(inverseBind[bone]).invert().elements[13];
  }));
  return gltf.meshes[node.mesh!].primitives.map(p=>({
   names,kneeY,positions:read(p.attributes.POSITION),joints:read(p.attributes.JOINTS_0),
   weights:read(p.attributes.WEIGHTS_0),indices:read(p.indices).flat(),
  }));
 });
}

describe.each(['straight','cargo','cropped','school-loafers'])('published %s leg binding',name=>{
 it('keeps every complete triangle below the knees owned by a single leg',()=>{
  let checked=0;const mixed:number[]=[];
  for(const p of loadGarment(name))for(let t=0;t<p.indices.length;t+=3){
   const vertices=p.indices.slice(t,t+3);
   if(vertices.some(i=>p.positions[i][1]>=p.kneeY-.01))continue;
   checked++;const sides=new Set<string>();
   for(const i of vertices)p.weights[i].forEach((weight,k)=>{
    if(weight<=1e-5)return;
    const match=/^([LR])_(?:thigh|shin|foot|toe)$/.exec(p.names[p.joints[i][k]]);
    if(match)sides.add(match[1]);
   });
   // This catches both one vertex shared by two legs and a fabric bridge
   // whose individually single-leg vertices belong to opposing legs.
   if(sides.size>1)mixed.push(t/3);
  }
  expect(checked,'must inspect actual lower-leg geometry').toBeGreaterThan(20);
  expect(mixed,'triangles pulled by both legs').toEqual([]);
 });
 it('ships finite, normalized weights with valid named joints',()=>{
  for(const p of loadGarment(name)){
   expect(p.weights.length).toBe(p.positions.length);expect(p.joints.length).toBe(p.positions.length);
   for(let i=0;i<p.weights.length;i++){
    expect(p.weights[i].every(w=>Number.isFinite(w)&&w>=0&&w<=1),`vertex ${i}: weights`).toBe(true);
    expect(p.weights[i].reduce((sum,w)=>sum+w,0),`vertex ${i}: weight sum`).toBeCloseTo(1,6);
    expect(p.joints[i].every(j=>Number.isInteger(j)&&Boolean(p.names[j])),`vertex ${i}: named joints`).toBe(true);
   }
  }
 });
});
