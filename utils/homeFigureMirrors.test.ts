// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {captureCreatorLayer} from '../apps/room3d/chibi/captureCreatorLayer';
import {flipHomeFigurePart} from './homeFigureParts';
import {tintIrisPairPixels,tintIrisPixels} from '../apps/room3d/chibi/faceTint';
afterEach(()=>vi.restoreAllMocks());
it('bakes the layer mirror and per-item mirrors without leaking transforms between items',()=>{
 const calls:any[]=[];
 const ctx={save:vi.fn(),restore:vi.fn(),translate:vi.fn(),scale:vi.fn(),drawImage:vi.fn((image)=>calls.push(image)),globalAlpha:1};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as any);
 vi.stubGlobal('DOMMatrixReadOnly',class {a:number;constructor(s:string){this.a=s==='scaleX(-1)'?-1:1;}});
 const layer=document.createElement('div');layer.style.transform='scaleX(-1)';
 layer.innerHTML='<div style="transform:scaleX(-1);opacity:.5"><img></div><div><img></div>';
 document.body.appendChild(layer);
 captureCreatorLayer(layer);
 expect(ctx.drawImage).toHaveBeenCalledTimes(2);
 // First child cancels its parent's mirror, second retains it.
 expect(ctx.scale).toHaveBeenCalledTimes(1);expect(ctx.scale).toHaveBeenCalledWith(-1,1);
 expect(ctx.save).toHaveBeenCalledTimes(2);expect(ctx.restore).toHaveBeenCalledTimes(2);
 layer.remove();vi.unstubAllGlobals();
});
it('changes only the selected part and leaves the 2D source untouched',()=>{
 const state={selected:{fronthair:'f',facemark:['a','b']},flipped:{fronthair:true,a:true}};
 const next=flipHomeFigurePart(state,'b');
 expect(next.flipped).toEqual({fronthair:true,a:true,b:true});
 expect(state.flipped).toEqual({fronthair:true,a:true});
 expect(flipHomeFigurePart(next,'fronthair').flipped).toEqual({fronthair:false,a:true,b:true});
});
it('colors each screen side on every row while preserving alpha, whites and masked lines',()=>{
 const source=new Uint8ClampedArray([128,128,128,180,128,128,128,200,255,255,255,255,5,5,5,255]);
 const expected=source.slice();tintIrisPixels(expected.subarray(0,4),'#ff0000');tintIrisPixels(expected.subarray(4,8),'#0000ff');
 const actual=source.slice();tintIrisPairPixels(actual,2,{L:'#ff0000',R:'#0000ff'});
 expect(actual).toEqual(new Uint8ClampedArray([...expected.subarray(0,12),0,0,0,255]));
 const one=source.slice();tintIrisPairPixels(one,2,{L:'#ff0000'});
 expect(one.subarray(4,8)).toEqual(source.subarray(4,8));expect(one.subarray(12)).toEqual(source.subarray(12));
 const masked=source.slice();tintIrisPairPixels(masked,2,{L:'#ff0000',R:'#0000ff'},new Uint8ClampedArray(source.length));expect(masked).toEqual(source);
});
