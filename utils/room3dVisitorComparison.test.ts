import {describe,it,expect} from 'vitest';
import {comparisonSpot,visitorFootprintWidth} from '../apps/room3d/visitorComparison.js';
import {ROOM_HALF} from '../apps/room3d/dimensions.js';
import {Group,Bone,BoxGeometry,SkinnedMesh,Skeleton,MeshBasicMaterial,Uint16BufferAttribute,Float32BufferAttribute} from 'three';
describe('Waiting actor clearance',()=>{
 it('refreshes a scaled skinned body after switching parents instead of retaining stale bind bounds',()=>{
  const root=new Group(),geometry=new BoxGeometry(2,2,2),count=geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(count*4),4));
  geometry.setAttribute('skinWeight',new Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4?0:1),4));
  const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial()),bone=new Bone();mesh.name='chibi-body';mesh.add(bone);root.add(mesh);
  root.updateMatrixWorld(true);const skeleton=new Skeleton([bone]);mesh.bind(skeleton);mesh.computeBoundingBox();
  root.scale.setScalar(.8);const visitor={root,rig:{skeleton}},waiting=new Group(),active=new Group();
  waiting.position.set(-3,.18,2);active.position.set(2,.6,-2);
  for(const parent of [waiting,active,waiting]){parent.add(root);expect(visitorFootprintWidth(visitor)).toBeCloseTo(1.68,5);}
  geometry.dispose();mesh.material.dispose();skeleton.dispose();
 });
 const base={offset:[10,20],width:1.8,activeWidth:1.6,active:[0,.18,2]};
 it('reserves a separate footprint and checks furniture in world coordinates',()=>{
  const calls:number[][]=[];
  const map={free:(x:number,z:number)=>{calls.push([x,z]);return x>9&&z>19;}};
  const point=comparisonSpot(map,base)!;
  expect(point).toBeTruthy();expect(point[1]).toBe(.18);
  expect(Math.abs(point[0])>=1.82||Math.abs(point[2]-2)>=1.82).toBe(true);
  expect(calls.at(-1)).toEqual([point[0]+10,point[2]+20]);
  expect(Math.abs(point[0])+base.width/2).toBeLessThan(ROOM_HALF.x);
 });
 it('keeps a valid waiting position, relocates a blocked one, and never forces a placement',()=>{
  const preferred=[-2,.18,0],free={free:()=>true};
  expect(comparisonSpot(free,{...base,preferred})).toBe(preferred);
  expect(comparisonSpot(free,{...base,preferred:[0,.18,2]})).not.toEqual([0,.18,2]);
  expect(comparisonSpot({free:()=>false},{...base,preferred})).toBeNull();
  const reserved=[preferred],moved=comparisonSpot(free,{...base,preferred,reserved})!;
  expect(moved).not.toEqual(preferred);
  expect(Math.abs(moved[0]-preferred[0])>=1.82||Math.abs(moved[2]-preferred[2])>=1.82).toBe(true);
 });
});
