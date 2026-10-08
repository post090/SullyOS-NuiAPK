import {expect,it} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {createBedSurface} from '../apps/room3d/chibi/bedSurface';

it('rests long hair on the bed independently, reuses a held pose and restores its authored shape',()=>{
 const body=new T.Group(),hair=new T.Group(),geometry=createBlankBody('skin'),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material);
 const longHair=new T.Mesh(new T.BoxGeometry(.3,4,.5),material);hair.add(longHair);body.add(mesh,hair);
 const rig=bindBlankBody(mesh,hair,true),original=longHair.geometry.attributes.position.clone(),normal=longHair.geometry.attributes.normal.clone(),support=createBedSurface(rig,body);
 body.updateMatrixWorld(true);rig.skeleton.update();const point=new T.Vector3();let skinMin=Infinity;
 for(let i=0;i<geometry.attributes.position.count;i++){rig.mesh.getVertexPosition(i,point);rig.mesh.localToWorld(point);skinMin=Math.min(skinMin,point.y);}
 body.position.y=-skinMin;support(.02);
 expect(body.position.y).toBeCloseTo(.02-skinMin);
 for(let i=0;i<original.count;i++){point.fromBufferAttribute(longHair.geometry.attributes.position,i).applyMatrix4(longHair.matrixWorld);expect(point.y).toBeGreaterThanOrEqual(.01999);}
 const version=(longHair.geometry.attributes.position as T.BufferAttribute).version;
 body.position.y=-skinMin;support(.02);expect((longHair.geometry.attributes.position as T.BufferAttribute).version).toBe(version);
 support.reset();expect(Array.from(longHair.geometry.attributes.position.array)).toEqual(Array.from(original.array));expect(Array.from(longHair.geometry.attributes.normal.array)).toEqual(Array.from(normal.array));
 geometry.dispose();longHair.geometry.dispose();material.dispose();rig.skeleton.dispose();
});

it.each([.8,1,1.25])('rests the back on the bed without head/skin penetration at body height %s',bodyHeight=>{
 const body=new T.Group(),hair=new T.Group(),geometry=createBlankBody('skin',{bodyHeight}),material=new T.MeshBasicMaterial();body.add(new T.Mesh(geometry,material),hair);
 const rig=bindBlankBody(body.children[0] as T.Mesh,hair,true),animate=createBlankMotion(rig,body);
 for(const bedMode of [undefined,'bed-talk','bed-phone'] as const){
 animate(3,'sleep','lying',{kind:'bed-rest',hands:[],bedTime:3,bedMode});body.updateMatrixWorld(true);rig.skeleton.update();
 const p=new T.Vector3(),min:Record<string,number>={};
 for(let i=0;i<geometry.attributes.position.count;i++){
  const g=geometry.attributes,weights=[0,1,2,3].map(j=>g.skinWeight.getComponent(i,j)),j=weights.indexOf(Math.max(...weights)),name=rig.skeleton.bones[g.skinIndex.getComponent(i,j)].name;
  rig.mesh.getVertexPosition(i,p);rig.mesh.localToWorld(p);min[name]=Math.min(min[name]??Infinity,p.y);
 }
 expect(Math.min(...Object.values(min))).toBeGreaterThanOrEqual(0);
 expect(min.hips).toBeLessThan(.25);expect(min.spine).toBeLessThan(.25);expect(min.chest).toBeLessThan(.30);
 }
 geometry.dispose();material.dispose();rig.skeleton.dispose();
});
