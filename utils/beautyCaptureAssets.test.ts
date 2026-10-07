// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {embedBeautyCaptureImages} from './beautyCaptureAssets';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function imageMocks(){
 vi.stubGlobal('SVGImageElement',class {});
 const NativeURL=URL;vi.stubGlobal('URL',class extends NativeURL {static createObjectURL=vi.fn(()=> 'blob:preview');static revokeObjectURL=vi.fn();});
 Object.defineProperty(HTMLImageElement.prototype,'decode',{configurable:true,value:vi.fn().mockResolvedValue(undefined)});
 vi.spyOn(HTMLImageElement.prototype,'naturalWidth','get').mockReturnValue(2);
 vi.spyOn(HTMLImageElement.prototype,'naturalHeight','get').mockReturnValue(2);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as any);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,cHJldmlldw==');
}
it('embeds shared img and CSS resources once, including pseudo-element paint spans',async()=>{
 imageMocks();const fetchMock=vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(['image'])});vi.stubGlobal('fetch',fetchMock);
 const root=document.createElement('div');root.innerHTML='<img src="https://images.example/art.png" loading="lazy"><span></span>';
 root.querySelector('span')!.style.backgroundImage='url("https://images.example/art.png")';
 await embedBeautyCaptureImages(root);
 expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
 expect(root.querySelector('img')!.src).toBe('data:image/png;base64,cHJldmlldw==');
 expect(root.querySelector('img')!.loading).toBe('eager');
 expect(root.querySelector('span')!.style.backgroundImage).toContain('data:image/png;base64,');
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
it('rejects failed image requests instead of silently producing an incomplete cover',async()=>{
 imageMocks();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('CORS')));
 const root=document.createElement('div');root.innerHTML='<img src="https://images.example/missing.png">';
 await expect(embedBeautyCaptureImages(root)).rejects.toThrow('不会提交缺图封面');
});
it('keeps local SVG fragment references and does not fetch unused CSS variables',async()=>{
 imageMocks();const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
 const root=document.createElement('div');root.style.filter='url("#shadow")';root.style.setProperty('--unused-art','url("https://images.example/unused.png")');
 await embedBeautyCaptureImages(root);expect(fetchMock).not.toHaveBeenCalled();expect(root.style.filter).toContain('#shadow');
});

it('reports a missing image path as HTTP 404 instead of blaming CORS',async()=>{
 imageMocks();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404}));
 const root=document.createElement('div');root.innerHTML='<img src="https://qegj567-cloud.github.io/sully/head.png">';
 await expect(embedBeautyCaptureImages(root)).rejects.toThrow('图片地址不存在（qegj567-cloud.github.io，HTTP 404）');
});

it('distinguishes local read failures from external image download failures',async()=>{
 imageMocks();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
 const root=document.createElement('div');root.style.backgroundImage='url("blob:https://example.com/frame")';
 await expect(embedBeautyCaptureImages(root)).rejects.toThrow('本地图片读取失败');
 root.style.backgroundImage='url("https://images.example/frame.png?private=secret")';
 await expect(embedBeautyCaptureImages(root)).rejects.toThrow('封面图片加载失败（images.example）');
});

it('does not mislabel decoding failures as cross-origin network failures and releases the image',async()=>{
 imageMocks();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(['broken'])}));
 vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValue(new Error('Invalid image'));
 const root=document.createElement('div');root.style.backgroundImage='url("data:image/png;base64,YnJva2Vu")';
 await expect(embedBeautyCaptureImages(root)).rejects.toThrow('解码或绘制失败');
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});

it('aborts an in-flight download on the overall capture deadline and stops before later images',async()=>{
 imageMocks();const fetchMock=vi.fn().mockReturnValue(new Promise(()=>{}));vi.stubGlobal('fetch',fetchMock);
 const root=document.createElement('div');root.innerHTML='<img src="https://images.example/first.png"><img src="https://images.example/second.png">';
 const controller=new AbortController();
 const pending=embedBeautyCaptureImages(root,controller.signal);
 const rejected=expect(pending).rejects.toThrow('封面图片加载超时');
 controller.abort(Error('封面图片加载超时'));
 await rejected;
 expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

