import {it,expect} from 'vitest';
import * as T from 'three';
import {createBlankBody,BLANK_SCALE} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {createSocialProp} from '../apps/room3d/chibi/socialProps';
import type {ChibiVisitor} from '../apps/room3d/chibi/visitor';
import {furniturePalm} from '../apps/room3d/chibi/furnitureMotion';
it('keeps the cup in the curled supporting hand through passing and sipping, under transformed parents',()=>{
 for(const heading of [0,1.2]){
 const scene=new T.Group();scene.rotation.y=heading;scene.position.set(2,.3,-1);
 const visitors=[0,1].map(i=>{const root=new T.Group(),body=new T.Group(),hair=new T.Group();scene.add(root);root.add(body);root.scale.setScalar(2.8/BLANK_SCALE);root.position.z=i===0?.35:-.35;root.rotation.y=i===0?Math.PI:0;const mesh=new T.Mesh(createBlankBody('skin',{bodyHeight:i===0?.8:1.25}),new T.MeshBasicMaterial());body.add(mesh,hair);const rig=bindBlankBody(mesh,hair,true);return {root,rig} as unknown as ChibiVisitor;});
 const prop=createSocialProp('cmu-22_13',visitors)!;const cup=scene.getObjectByName('social-water-cup')!;
 for(const time of [1,2.1,2.25,2.27,2.5,3,5.7,7.4]){
 visitors.forEach(v=>v.rig!.setPose('relaxed'));scene.updateMatrixWorld(true);prop.update(time,7.65,1);scene.updateMatrixWorld(true);
 const i=time<2.26?0:1,side=i===0?'L':'R',rig=visitors[i].rig!;
 const offset=new T.Vector3(i===0?.010:-.010,-.018,.010).multiplyScalar(BLANK_SCALE);
 expect(cup.getWorldPosition(new T.Vector3()).distanceTo(rig.bones[side+'_hand'].localToWorld(furniturePalm(side).add(offset)))).toBeLessThan(1e-6);
 expect(rig.bones[side+'_index'].quaternion.angleTo(new T.Quaternion())).toBeGreaterThan(.5);
 expect(cup.matrixWorld.elements.every(Number.isFinite)).toBe(true);
 expect(rig.skeleton.bones).toHaveLength(48);
 }
 prop.dispose();expect(scene.getObjectByName('social-water-cup')).toBeUndefined();
 }
});
