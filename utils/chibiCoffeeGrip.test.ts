import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createBlankMotion} from '../apps/room3d/chibi/blankMotion';
import {coffeeGrip,COFFEE_HANDLE_GRIP} from '../apps/room3d/coffeeGrip.js';
import {createKitchenWorkEffects} from '../apps/room3d/kitchenWorkEffects.js';

it('keeps the handle inside the posed fingers through brewing and the imported drink, at different sizes and headings',()=>{
 const resident=new T.Group(),sized=new T.Group(),body=new T.Group(),hair=new T.Group();
 resident.add(sized);sized.add(body);
 const geometry=createBlankBody('skin'),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material);
 body.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true),animate=createBlankMotion(rig,body),fx=createKitchenWorkEffects(resident);
 const cup=fx.root.getObjectByName('coffee-cup')!;
 const source={point:[1,2,3]},hands=[[-.2,.7,.3],[.2,.7,.3]],lengths=rig.skeleton.bones.map(b=>b.position.length());
 for(const scale of [.35,.529,.75])for(const heading of [0,.8,Math.PI]){
  sized.scale.setScalar(scale);resident.position.set(3,.18,-2);resident.rotation.y=heading;
  for(const stage of ['work','sip'])for(let t=stage==='work'?5.2:0;t<8.8;t+=.15){
   animate(t,'coffee','standing',{kind:'coffee',hands,carrying:stage==='sip',...(stage==='sip'?{clip:'coffee-drink' as const,clipTime:t}:{})});
   fx.update({kind:'coffee',stage,source},t,hands,coffeeGrip(resident,rig));
   resident.updateWorldMatrix(true,true);
   const finger=rig.bones.L_index_tip.getWorldPosition(new T.Vector3()).lerp(rig.bones.L_middle_tip.getWorldPosition(new T.Vector3()),.5);
   expect(cup.localToWorld(COFFEE_HANDLE_GRIP.clone()).distanceTo(finger)).toBeLessThan(1e-6);
   expect(rig.skeleton.bones.map(b=>b.position.length())).toEqual(lengths);
  }
 }
 fx.clear();expect(fx.root.visible).toBe(false);
 fx.update({kind:'coffee',stage:'work',source},0,hands,coffeeGrip(resident,rig));
 expect(cup.quaternion.angleTo(new T.Quaternion())).toBeLessThan(1e-6);
 expect(cup.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(1,2.035,3))).toBeLessThan(1e-6);
 fx.dispose();rig.skeleton.dispose();geometry.dispose();material.dispose();
});
