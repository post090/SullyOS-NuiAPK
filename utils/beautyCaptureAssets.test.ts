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

