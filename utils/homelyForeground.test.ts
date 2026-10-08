// @vitest-environment jsdom
import * as THREE from 'three';
import {afterEach,expect,it,vi} from 'vitest';
import {createHomelyForeground} from '../apps/room3d/homelyForeground.js';
import {homelyPeekTarget} from '../apps/room3d/homelyPresence';
afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});
function setup(){
 const ctx={clearRect:vi.fn(),drawImage:vi.fn()};vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as any);
 const container=document.createElement('div');container.innerHTML='<div class="stage"></div><div class="homely-chat"><section class="home-life-sheet"></section></div>';document.body.append(container);
 const rect=(x:number,y:number,w:number,h:number)=>({x,y,left:x,top:y,right:x+w,bottom:y+h,width:w,height:h,toJSON:()=>({})});
 container.getBoundingClientRect=()=>rect(0,0,1000,700) as DOMRect;
 const stage=container.querySelector('.stage')! as HTMLElement;stage.getBoundingClientRect=container.getBoundingClientRect;
 container.querySelector('.home-life-sheet')!.getBoundingClientRect=()=>rect(580,20,400,530) as DOMRect;
 const scene=new THREE.Scene(),resident=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),room=new THREE.Mesh(),light=new THREE.HemisphereLight();resident.add(mesh);scene.add(resident,room,light);scene.background=new THREE.Color('pink');
 const camera=new THREE.OrthographicCamera(-5,5,3.5,-3.5,.1,100);camera.position.z=40;camera.updateMatrixWorld();
 const renderer={domElement:document.createElement('canvas'),shadowMap:{enabled:true},getClearColor:(c:THREE.Color)=>c.set('pink'),getClearAlpha:()=>1,setClearColor:vi.fn(),render:vi.fn()};
 const foreground=createHomelyForeground({renderer,scene,camera,resident,container,stage});return {foreground,renderer,scene,camera,resident,mesh,room,light,container,ctx};
}
it('places the live actor in a transparent layer in front of the real panel, without changing the room camera',()=>{
 const t=setup(),head=new THREE.Vector3(0,1.2,0),original=t.camera.position.clone();
 t.renderer.render.mockImplementation((scene:THREE.Scene,camera:THREE.OrthographicCamera)=>{expect(scene.background).toBeNull();expect(camera.layers.test(t.mesh.layers)).toBe(true);expect(camera.layers.test(t.room.layers)).toBe(false);expect(camera.layers.test(t.light.layers)).toBe(true);const p=head.clone().project(camera);expect((p.x+1)*500).toBeCloseTo(612);expect((1-p.y)*350).toBeCloseTo(200.2);});
 const restore=t.foreground.capture(1,head);expect(t.resident.visible).toBe(false);expect(t.ctx.drawImage).toHaveBeenCalledOnce();expect(t.camera.position.equals(original)).toBe(true);expect(t.camera.zoom).toBe(1);expect(t.mesh.layers.mask).toBe(1);expect(t.renderer.shadowMap.enabled).toBe(true);restore?.();expect(t.resident.visible).toBe(true);
 const canvas=t.container.querySelector('.homely-foreground') as HTMLCanvasElement;expect(canvas.hidden).toBe(false);t.foreground.hide();expect(canvas.hidden).toBe(true);t.foreground.dispose();expect(canvas.isConnected).toBe(false);
});
it('restores lighting and layers even when the foreground render fails',()=>{const t=setup(),bg=t.scene.background;t.renderer.render.mockImplementation(()=>{throw Error('render failed');});expect(()=>t.foreground.capture(1,new THREE.Vector3())).toThrow('render failed');expect(t.scene.background).toBe(bg);expect(t.resident.visible).toBe(true);expect(t.light.layers.mask).toBe(1);expect(t.mesh.layers.mask).toBe(1);expect(t.renderer.shadowMap.enabled).toBe(true);});
it('keeps the face inside the panel edge at both phone and desktop widths',()=>{for(const width of [180,210,400,420]){const p=homelyPeekTarget({left:170,top:20,width,height:600});expect(p.x).toBeGreaterThan(170);expect(p.x).toBeLessThan(170+width/4);expect(p.y).toBeLessThan(400);}});
