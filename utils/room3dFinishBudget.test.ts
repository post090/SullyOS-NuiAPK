import {expect,it,vi} from 'vitest';
import {createRoomFinishPass} from '../apps/room3d/roomFinishPass.js';

it('keeps the sharp source full size and samples only the halo at quarter pixel count, reusing buffers',()=>{
 let width=1170,height=2532,target:any=null;
 const draws:any[]=[],buffers:any[]=[];
 const renderer={autoClear:true,getDrawingBufferSize(v:any){v.set(width,height);},getRenderTarget(){return target;},setRenderTarget(t:any){target=t;if(t&&!buffers.includes(t))buffers.push(t);},copyFramebufferToTexture:vi.fn(),render(mesh:any){draws.push({target,uniforms:mesh.material.uniforms});}};
 const finish=createRoomFinishPass(renderer);finish.render('day');
 expect(draws).toHaveLength(2);expect(draws[0].target.width).toBe(585);expect(draws[0].target.height).toBe(1266);
 expect(draws[1].target).toBeNull();expect(draws[1].uniforms.source.value.image).toMatchObject({width:1170,height:2532});
 const source=draws[1].uniforms.source.value,halo=buffers[0],disposed=vi.fn();halo.addEventListener('dispose',disposed);
 finish.render('night');expect(buffers).toHaveLength(1);expect(draws[3].uniforms.source.value).toBe(source);
 width=2532;height=1170;finish.render('sunset');expect(disposed).toHaveBeenCalledTimes(1);expect(buffers[1]).toMatchObject({width:1266,height:585});
 expect(renderer.autoClear).toBe(true);expect(target).toBeNull();finish.dispose();
});

it('restores renderer target and clearing after a failed glow pass',()=>{
 const original={};let target:any=original;
 const renderer={autoClear:true,getDrawingBufferSize(v:any){v.set(300,600);},getRenderTarget(){return target;},setRenderTarget(t:any){target=t;},copyFramebufferToTexture(){},render(){throw Error('render failed');}};
 const finish=createRoomFinishPass(renderer);expect(()=>finish.render('day')).toThrow('render failed');expect(target).toBe(original);expect(renderer.autoClear).toBe(true);finish.dispose();
});
