import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {fitFlatView,FLAT_VIEW_DIRECTION} from '../apps/room3d/flatView.js';
import {wallVisible} from '../apps/room3d/topology.js';
import {setCharacterIllustration} from '../apps/room3d/chibi/illustration';

describe('flat room presentation',()=>{
 it('fits every room corner in portrait and landscape without changing the viewing direction',()=>{
  const box=new T.Box3(new T.Vector3(-6,-.5,-5),new T.Vector3(15,10,7));
  const camera=new T.OrthographicCamera(-1,1,1,-1,.1,200);
  const controls={target:new T.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld(true);}};
  for(const aspect of [390/844,1280/720]){
   fitFlatView(camera,controls,box,aspect,true);
   expect(camera.position.clone().sub(controls.target).normalize().distanceTo(FLAT_VIEW_DIRECTION)).toBeLessThan(1e-10);
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const screen=new T.Vector3(x,y,z).project(camera);
    expect(Math.abs(screen.x)).toBeLessThan(1);expect(Math.abs(screen.y)).toBeLessThan(1);expect(Math.abs(screen.z)).toBeLessThan(1);
   }
   camera.zoom=1.6;fitFlatView(camera,controls,box,aspect);expect(camera.zoom).toBe(1.6);
  }
 });
 it('cuts away front and right shared walls while preserving free-view wall visibility',()=>{
  for(const internal of [false,true]){
   expect(wallVisible('flat','front',internal)).toBe(false);
   expect(wallVisible('flat','right',internal)).toBe(false);
   expect(wallVisible('flat','back',internal)).toBe(true);
   expect(wallVisible('flat','left',internal)).toBe(true);
  }
  expect(wallVisible('cutaway','front',true)).toBe(true);
  expect(wallVisible('dollhouse','right')).toBe(true);
 });
 it('preserves painted maps, transparency, geometry and earlier shader hooks across style comparisons',()=>{
  const map=new T.Texture(),material=new T.MeshStandardMaterial({map,alphaTest:.2,side:T.DoubleSide});
  const hook=(shader:any)=>{shader.fragmentShader='// garment\n'+shader.fragmentShader;};
  material.onBeforeCompile=hook;material.customProgramCacheKey=()=>'garment';
  const root=new T.Group(),geometry=new T.BoxGeometry();root.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material));
  for(let i=0;i<2;i++){
   setCharacterIllustration(root);setCharacterIllustration(root);
   const shader={uniforms:{},fragmentShader:'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;'};
   material.onBeforeCompile(shader as any,{} as any);
   expect(shader.fragmentShader).toContain('// garment');
   expect(shader.fragmentShader.match(/vec3 inkLight/g)).toHaveLength(1);
   expect(material.map).toBe(map);expect(material.alphaTest).toBe(.2);expect(root.children).toHaveLength(2);
   expect(material.toneMapped).toBe(false);
   setCharacterIllustration(root,false);
   expect(material.onBeforeCompile).toBe(hook);expect(material.customProgramCacheKey()).toBe('garment');expect(material.toneMapped).toBe(true);
  }
  geometry.dispose();material.dispose();map.dispose();
 });
});
