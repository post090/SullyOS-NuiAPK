import {describe,it,expect} from 'vitest';
import body from '../apps/room3d/chibi/blankBody.json';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';

describe('refined chibi body',()=>{
 it('has shared elbow rings so long arm triangles do not span the bend center',()=>{
  for(const plane of [-.21,.21]){
   const ring=body.positions.filter((x,i)=>i%3===0&&Math.abs(x-plane)<1e-7);
   expect(ring.length).toBeGreaterThan(8);
   for(let i=0;i<body.indices.length;i+=3){const ids=body.indices.slice(i,i+3);
    if(!ids.every(id=>body.positions[id*3+1]>.03&&body.positions[id*3+1]<.13))continue;
    const xs=ids.map(id=>body.positions[id*3]);
    expect(Math.min(...xs)<plane-1e-7&&Math.max(...xs)>plane+1e-7).toBe(false);
   }
  }
 });
 it('stays within budget with one closed connected surface',()=>{
  const count=body.positions.length/3,edges=new Map<string,number>(),neighbors=Array.from({length:count},()=>new Set<number>());
  expect(body.indices.length/3).toBeLessThanOrEqual(6500);
  for(let i=0;i<body.indices.length;i+=3)for(let j=0;j<3;j++){
   const a=body.indices[i+j],b=body.indices[i+(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;
   edges.set(key,(edges.get(key)||0)+1);neighbors[a].add(b);neighbors[b].add(a);
  }
  expect([...edges.values()].every(n=>n===2)).toBe(true);
  const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of neighbors[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}
  expect(seen.size).toBe(count);
 });
 it('keeps smooth normals finite and normalized across proportion extremes',()=>{
  expect(body.normals.length).toBe(body.positions.length);
  for(const headSize of [.75,1.04,1.4])for(const bodyHeight of [.8,1,1.25]){
   const geometry=createBlankBody('skin',{headSize,bodyHeight});
   try{const n=geometry.attributes.normal;for(let i=0;i<n.count;i++)expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,5);}
   finally{geometry.dispose();}
  }
 });
});
