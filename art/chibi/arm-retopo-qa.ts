import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import body from '../../apps/room3d/chibi/blankBody.json';
import {createBlankBody} from '../../apps/room3d/chibi/blankBody';
test('arm tube rings are regular and the whole surface stays closed and connected',()=>{
 assert.ok(body.indices.length/3<=6500);
 const count=body.positions.length/3,neighbors=Array.from({length:count},()=>new Set<number>()),edges=new Map<string,number>();
 for(let i=0;i<body.indices.length;i+=3)for(let j=0;j<3;j++){const a=body.indices[i+j],b=body.indices[i+(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);neighbors[a].add(b);neighbors[b].add(a);}
 assert.ok([...edges.values()].every(n=>n===2));const seen=new Set([0]),queue=[0];for(const i of queue)for(const j of neighbors[i])if(!seen.has(j)){seen.add(j);queue.push(j);}assert.equal(seen.size,count);
 for(const side of [-1,1])for(const x of [.145,.185,.21,.245,.278,.2925])assert.equal(body.positions.filter((v,i)=>i%3===0&&Math.abs(v-side*x)<1e-7).length,20);
});
test('unmodified body regions remain unchanged outside arm and calf tubes',()=>{
 const before=JSON.parse(readFileSync('output/wardrobe-pose/body-before-arm-retopo.json','utf8'));
 const outside=(p:number[])=>{const result:string[]=[];for(let i=0;i<p.length;i+=3){const [x,y,z]=p.slice(i,i+3);if(!(Math.abs(x)>=.12&&Math.abs(x)<=.305&&y>.03&&y<.13)&&!(y>=-.44000001&&y<=-.29999999))result.push(JSON.stringify([x,y,z]));}return result.sort();};
 assert.deepEqual(outside(body.positions),outside(before.positions));
});
test('retopologized body normals stay normalized across supported proportions',()=>{
 for(const bodyHeight of [.8,1,1.25])for(const headSize of [.75,1,1.4]){const g=createBlankBody('skin',{bodyHeight,headSize});const n=g.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);g.dispose();}
});

test('calf edit preserves approved arms, torso and feet exactly',()=>{
 const before=JSON.parse(readFileSync('output/wardrobe-pose/body-before-calf-retopo.json','utf8'));
 const outside=(p:number[])=>{const out:string[]=[];for(let i=0;i<p.length;i+=3){const v=p.slice(i,i+3);if(v[1]<-.44000001||v[1]>-.29999999)out.push(JSON.stringify(v));}return out.sort();};
 assert.deepEqual(outside(body.positions),outside(before.positions));
});
