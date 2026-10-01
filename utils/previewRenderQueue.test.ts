import {it,expect,vi} from 'vitest';
import {enqueuePreviewBuild} from './previewRenderQueue';

it('builds one thumbnail per frame and cancels thumbnails that leave the screen',async()=>{
 const frames:FrameRequestCallback[]=[];
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.push(callback);return frames.length;});
 const work=vi.fn();
 try{
  enqueuePreviewBuild(()=>work('first'));
  const cancel=enqueuePreviewBuild(()=>work('hidden'));
  enqueuePreviewBuild(()=>work('last'));cancel();
  expect(work).not.toHaveBeenCalled();expect(frames).toHaveLength(1);
  await frames.shift()!(0);expect(work.mock.calls).toEqual([['first']]);
  await frames.shift()!(16);expect(work.mock.calls).toEqual([['first'],['last']]);
  expect(frames).toHaveLength(0);
 }finally{vi.unstubAllGlobals();}
});
