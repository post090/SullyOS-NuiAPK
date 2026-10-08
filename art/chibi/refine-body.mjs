// Geometry-only rebuild: high-resolution reference + connected five-finger hands.
// pnpm node art/chibi/refine-body.mjs <reference.glb> <output.json>
import fs from 'node:fs/promises';
import * as T from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import {readGeometry,compactGeometry,saveGlb,splitParts} from '../jellyfish-home/asset-geometry.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Pass reference GLB and destination JSON');
await MeshoptSimplifier.ready;
const [original]=await readGeometry(input);original.computeBoundingBox();const bounds=original.boundingBox,center=bounds.getCenter(new T.Vector3()),height=bounds.max.y-bounds.min.y;
original.translate(-center.x,-center.y,-center.z);original.scale(1/height,1/height,1/height);
const pos=original.attributes.position;
// Broad lower-face profile requested by the user: mouth-to-chin arc, no nose tip.
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
 const lowerFace=T.MathUtils.smoothstep(y,.165,.22)*(1-T.MathUtils.smoothstep(y,.23,.29));
 const front=T.MathUtils.smoothstep(z,.06,.12)*(1-T.MathUtils.smoothstep(Math.abs(x),.055,.14));
 pos.setZ(i,z+.016*lowerFace*front);
}
function clip(g,distance){
 const p=g.attributes.position,out=[];
 for(let i=0;i<g.index.count;i+=3){const poly=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,g.index.getX(i+j))),clipped=[];
  for(let j=0;j<3;j++){const a=poly[j],b=poly[(j+1)%3],da=distance(a),db=distance(b);if(da>=0)clipped.push(a);if((da>=0)!==(db>=0))clipped.push(a.clone().lerp(b,da/(da-db)));}
  for(let j=1;j<clipped.length-1;j++)for(const v of [clipped[0],clipped[j],clipped[j+1]])out.push(v.x,v.y,v.z);
 }const raw=new T.BufferGeometry();raw.setAttribute('position',new T.Float32BufferAttribute(out,3));return mergeVertices(raw,1e-6);
}
async function reduce(g,budget){
 g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,normalByPosition=new Map(),locks=new Uint8Array(p.count);
 const key=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)].join(',');
 for(let i=0;i<p.count;i++){normalByPosition.set(key(p,i),[n.getX(i),n.getY(i),n.getZ(i)]);if(Math.abs(p.getX(i))<.010&&p.getY(i)>.18&&p.getY(i)<.29&&p.getZ(i)>.1)locks[i]=1;}
 const [ids]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(g.index.array),p.array,3,n.array,3,[.035,.035,.035],locks,budget*3,1),reduced=await compactGeometry(g,Array.from(ids)),rp=reduced.attributes.position,normal=[];
 for(let i=0;i<rp.count;i++)normal.push(...normalByPosition.get(key(rp,i)));reduced.setAttribute('normal',new T.Float32BufferAttribute(normal,3));return reduced;
}
const body=await reduce(clip(clip(original,v=>.282-v.x),v=>v.x+.282),2800);

// Smooth union keeps each digit attached to one palm, no stacked separate balls.
const smin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function capsule(x,y,z,a,b,r){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],t=T.MathUtils.clamp(((x-a[0])*dx+(y-a[1])*dy+(z-a[2])*dz)/(dx*dx+dy*dy+dz*dz),0,1);return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t,z-a[2]-dz*t)-r;}
const fingers=[
 [[.333,.085,-.024],[.360,.085,-.033],.0072],
 [[.340,.086,-.009],[.373,.086,-.013],.0076],
 [[.342,.086,.008],[.378,.086,.010],.0078],
 [[.337,.086,.025],[.370,.086,.032],.0075],
 [[.313,.079,.023],[.333,.077,.050],.008],
];
const size=64,half=.082,c=[.328,.086,.006],mc=new MarchingCubes(size,new T.MeshBasicMaterial(),false,false,30000);mc.isolation=0;
for(let k=0;k<size;k++)for(let j=0;j<size;j++)for(let i=0;i<size;i++){
 const x=(i/size*2-1)*half+c[0],y=(j/size*2-1)*half+c[1],z=(k/size*2-1)*half+c[2];
 let d=(Math.hypot((x-.324)/.024,(y-.086)/.017,(z-.003)/.030)-1)*.017;
 // Chibi wrists keep the forearm's broad profile: no anatomical pinch/waist.
 d=smin(d,capsule(x,y,(z-.006)*.021/.032,[.269,.088,0],[.316,.088,0],.021),.008);
 for(const [a,b,r] of fingers)d=smin(d,capsule(x,y,z,a,b,r),.007);
 mc.field[k*size*size+j*size+i]=-d;
}mc.update();const handRaw=new T.BufferGeometry();handRaw.setAttribute('position',new T.Float32BufferAttribute(mc.geometry.attributes.position.array.slice(0,mc.count*3),3));handRaw.scale(half,half,half);handRaw.translate(...c);
const hand=await reduce(clip(mergeVertices(handRaw,1e-6),v=>v.x-.300),450);
const positions=Array.from(body.attributes.position.array),indices=Array.from(body.index.array),normals=Array.from(body.attributes.normal.array);
function ring(g,plane){const p=g.attributes.position,ids=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-plane)<2e-5)ids.push(i);return ids.sort((a,b)=>Math.atan2(p.getZ(a)-.009,p.getY(a)-.088)-Math.atan2(p.getZ(b)-.009,p.getY(b)-.088));}
function stitch(a,b){
 const theta=id=>Math.atan2(positions[id*3+2]-.009,positions[id*3+1]-.088),v=id=>new T.Vector3(...positions.slice(id*3,id*3+3));
 const add=(i,j,k)=>{const x=v(i),y=v(j),z=v(k),normal=y.clone().sub(x).cross(z.clone().sub(x)),mid=x.clone().add(y).add(z).multiplyScalar(1/3);if(normal.dot(new T.Vector3(0,mid.y-.088,mid.z-.009))<0)indices.push(i,k,j);else indices.push(i,j,k);};
 let i=0,j=0;while(i<a.length||j<b.length){const nextA=i<a.length?theta(a[(i+1)%a.length])+(i+1>=a.length?Math.PI*2:0):Infinity,nextB=j<b.length?theta(b[(j+1)%b.length])+(j+1>=b.length?Math.PI*2:0):Infinity;
  if(nextA<=nextB){add(a[i%a.length],a[(i+1)%a.length],b[j%b.length]);i++;}else{add(a[i%a.length],b[(j+1)%b.length],b[j%b.length]);j++;}
 }
}
for(const sign of [-1,1]){
 const offset=positions.length/3,p=hand.attributes.position,n=hand.attributes.normal;for(let i=0;i<p.count;i++){positions.push(sign*p.getX(i),p.getY(i),p.getZ(i));normals.push(sign*n.getX(i),n.getY(i),n.getZ(i));}
 for(let i=0;i<hand.index.count;i+=3){const ids=[0,1,2].map(j=>offset+hand.index.getX(i+j));indices.push(...(sign<0?[ids[0],ids[2],ids[1]]:ids));}
 stitch(ring(body,sign*.282),ring(hand,.300).map(id=>id+offset));
}
const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setIndex(indices);result.computeVertexNormals();
// Preserve the reference's smooth surface normals at retained vertices; average
// only the new wrist joins, which did not exist in either source surface.
for(let i=0;i<positions.length/3;i++)if(Math.abs(Math.abs(positions[i*3])-.282)<2e-5||Math.abs(Math.abs(positions[i*3])-.300)<2e-5){const n=result.attributes.normal;normals.splice(i*3,3,n.getX(i),n.getY(i),n.getZ(i));}
result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
const components=splitParts(result);if(indices.length/3>4000)throw Error('Body exceeded 4000 triangles');if(components.length!==1)throw Error(`Expected connected body, found ${components.length}`);
await fs.writeFile(output,JSON.stringify({positions,indices,normals}));const scene=new T.Group();scene.add(new T.Mesh(result,new T.MeshStandardMaterial({color:'#d6c3b4',roughness:1})));await saveGlb(scene,'output/body-refinement/refined.glb');
console.log({vertices:positions.length/3,triangles:indices.length/3,body:body.index.count/3,perHand:hand.index.count/3,components:components.length,output});
