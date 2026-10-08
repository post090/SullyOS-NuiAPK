import {it,expect} from 'vitest';
import * as T from 'three';
import catalog from '../public/room3d/catalog.json';
import {bathroomHome} from '../test/fixtures/bathroom-layout.js';
import {bathroomActivities} from '../apps/room3d/bathroom.js';
import {bathroomEntryCandidates,createBathroomJourney,bathroomJourneyFrame} from '../apps/room3d/bathroomJourney.js';
import {walkingMap,findWalkPath} from '../apps/room3d/navigation.js';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';

it('uses reachable furniture fronts, sits on the tub rim before turning legs, and exits to the same floor point',()=>{
 const h=bathroomHome(catalog),r=h.rooms[0],map=walkingMap(h,0,catalog,{headWidth:1.5});
 for(const a of bathroomActivities(r,catalog,{headWidth:1.5,body2:true})){
  expect(a.reason,a.kind).toBe('');const item=r.items.find(i=>i.id===a.itemId)!;
  const front=bathroomEntryCandidates(item,a.kind).find(p=>findWalkPath(map,[0,2.7],[p[0],p[2]]));expect(front,a.kind).toBeTruthy();
  const j=createBathroomJourney(a,front!,0),before=structuredClone(j),start=bathroomJourneyFrame(j,0),work=bathroomJourneyFrame(j,j.enter+2),end=bathroomJourneyFrame(j,100);
  expect(start.position).toEqual(front);expect(start.seatWeight).toBe(0);expect(work.position).toEqual(a.position);expect(work.phase).toBe('work');
  expect(end.position).toEqual(front);expect(end.seatWeight).toBe(0);expect(end.done).toBe(true);expect(j).toEqual(before);
  if(a.kind==='bath-soak'){const edge=bathroomJourneyFrame(j,1.2);expect(edge.position).toEqual(a.edge);expect(edge.seatWeight).toBe(1);expect(edge.legLift).toBe(0);expect(work.legLift).toBe(1);}
 }
});

it('keeps feet along the bathtub interior and preserves all bones across bathroom activities and interrupt',()=>{
 const root=new T.Group(),body=new T.Group(),hair=new T.Group(),g=createBlankBody('skin'),m=new T.MeshBasicMaterial(),mesh=new T.Mesh(g,m);root.add(body);body.add(mesh,hair);root.scale.setScalar(.529);
 const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body),lengths=rig.skeleton.bones.map(b=>b.position.length());
 for(const kind of ['bath-soak','bath-shower','bath-laundry','bath-toilet']as const)for(let t=0;t<12;t+=.1){
  const seated=kind==='bath-soak'||kind==='bath-toilet';
  animate(t,kind,seated?'seated':'standing',{kind,hands:[],bathPhase:'work',seatWeight:seated?1:0,bathLegLift:1});
  expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);expect(rig.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))).toBe(true);
  if(kind==='bath-soak')for(const n of ['L_foot','R_foot']){const p=rig.bones[n].getWorldPosition(new T.Vector3());expect(p.z).toBeGreaterThan(.65);expect(p.z).toBeLessThan(1.4);expect(Math.abs(p.x)).toBeLessThan(.3);}
 }
 animate(0,'idle','standing');expect(body.position.length()).toBe(0);expect(rig.skeleton.bones).toHaveLength(48);rig.skeleton.dispose();g.dispose();m.dispose();
});
