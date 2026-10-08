import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {setCharacterIllustration,setCharacterRoomLighting} from '../apps/room3d/chibi/illustration';
import {createRoomLightUniforms,updateRoomLightUniforms,ROOM_LIGHT_PHASES} from '../apps/room3d/roomLighting.js';
import {inferWindowAperture,windowSunPose} from '../apps/room3d/windowAperture.js';

describe('room actors share lighting without losing painted materials',()=>{
 it('binds shared live uniforms to every resident mesh and receives cached room shadows',()=>{
  const root=new T.Group(),map=new T.Texture(),material=new T.MeshStandardMaterial({map,alphaTest:.3}),mesh=new T.Mesh(new T.BoxGeometry(),material);
  root.add(mesh);setCharacterIllustration(root);
  const compile=()=>{const s={uniforms:{},fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(s as any,{} as any);return s.uniforms as any;};
  expect(compile().characterRoomEnabled.value).toBe(0);
  const light=createRoomLightUniforms();setCharacterRoomLighting(root,light);const shader=compile();
  expect(mesh.receiveShadow).toBe(true);expect(mesh.castShadow).toBe(false);
  expect(shader.characterRoomEnabled.value).toBe(1);expect(shader.roomSunTint).toBe(light.roomSunTint);
  const version=material.version;setCharacterRoomLighting(root,light);expect(material.version).toBe(version);
  updateRoomLightUniforms(light,ROOM_LIGHT_PHASES.sunset);expect(shader.roomSunTint.value.getHexString()).toBe('ffdfb9');
  updateRoomLightUniforms(light,ROOM_LIGHT_PHASES.night);expect(shader.roomBrightness.value).toBe(.86);
  expect(material.map).toBe(map);expect(material.alphaTest).toBe(.3);expect(material.version).toBe(version);
  mesh.geometry.dispose();material.dispose();map.dispose();
 });
});

describe('sun comes through actual normalized window panes',()=>{
 it('uses pane bounds, including normalization and offset, ignoring curtains and frame',()=>{
  const root=new T.Group(),pane=new T.Mesh(new T.BoxGeometry(2,3,.02),new T.MeshStandardMaterial({name:'glass'}));
  pane.position.set(.25,2,0);root.add(pane);root.scale.setScalar(2);
  const frame=new T.Mesh(new T.BoxGeometry(8,8,1),new T.MeshStandardMaterial({name:'wood'}));root.add(frame);
  expect(inferWindowAperture(root)).toEqual({width:4,bottom:1,top:7,offset:.5});root.remove(pane);expect(inferWindowAperture(root)).toBeNull();
  for(const o of [pane,frame]){o.geometry.dispose();o.material.dispose();}
 });
 it.each([0,90,180,270])('points inward and down on a window rotated %i degrees',rotation=>{
  for(const phase of ['morning','sunset']){
   const source={position:[2,3,4],item:{rotation}},pose=windowSunPose(source,phase),ray=new T.Vector3(...pose.target).sub(new T.Vector3(...pose.position));
   expect(ray.y).toBeLessThan(0);const a=rotation*Math.PI/180;expect(ray.x*Math.sin(a)+ray.z*Math.cos(a)).toBeCloseTo(10);expect(pose.target).toEqual(source.position);
  }
 });
});
