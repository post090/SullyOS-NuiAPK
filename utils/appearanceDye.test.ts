import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {tintAppearancePixels} from '../apps/room3d/chibi/appearanceColors';
const html=readFileSync('public/like520/character_creator.html','utf8');
const section=(start:string,end:string)=>html.slice(html.indexOf(start),html.indexOf(end));
const helpers=section('function hslToRgb(', '/* 解析 tintColor')+section('function colorHsl(', '/* ===== 取翻转状态');
const tint=section('function applyTint(', '/* 眼睛分左右染色');
function legacy(pixels:Uint8ClampedArray,width:number,height:number,color:string,gradientColor?:string,skin=false){
 const ctx={getImageData:()=>({data:pixels}),putImageData:()=>{}};
 runInNewContext(`${helpers}\n${tint}\napplyTint(canvas,{...resolveTint({color,gradientColor}),skin});`,{state:{preserveLineart:25},canvas:{width,height,getContext:()=>ctx},color,gradientColor,skin});
}
it('uses distinct root/tip colors in both creators while retaining alpha and linework',()=>{
 const source=new Uint8ClampedArray(11*3*4);
 for(let y=0;y<11;y++)source.set([128,128,128,255,10,10,10,255,88,77,66,0],y*12);
 const actual=source.slice(),old=source.slice();tintAppearancePixels(actual,3,11,'#ff0000','#0000ff');legacy(old,3,11,'#ff0000','#0000ff');
 // HSL implementations can round a channel one level apart.
 for(let i=0;i<actual.length;i++)expect(Math.abs(actual[i]-old[i])).toBeLessThanOrEqual(1);expect(actual[0]).toBeGreaterThan(actual[2]);expect(actual[120]).toBeLessThan(actual[122]);
 for(let y=0;y<11;y++){expect([...actual.slice(y*12+4,y*12+8)]).toEqual([0,0,0,255]);expect([...actual.slice(y*12+8,y*12+12)]).toEqual([88,77,66,0]);}
});
it('switches back to a uniform color without a stale gradient',()=>{
 const pixels=new Uint8ClampedArray(Array.from({length:11},()=>[128,128,128,255]).flat());
 tintAppearancePixels(pixels,1,11,'#cc8855');expect([...pixels.slice(0,4)]).toEqual([...pixels.slice(-4)]);
});
it('recolors the original skin around the chosen color instead of washing it out',()=>{
 const pixels=new Uint8ClampedArray([200,200,200,255,220,220,220,255,240,240,240,255]);legacy(pixels,3,1,'#806040',undefined,true);
 expect([...pixels.slice(4,7)]).toEqual([128,96,64]);expect(pixels[0]).toBeLessThan(pixels[4]);expect(pixels[8]).toBeGreaterThan(pixels[4]);
});
it('restores linked gradients and custom skin from saved state and rejects invalid colors',()=>{
 const state:any={selected:{},tintColor:{fronthair:{hueIdx:0,sat:50,light:0},skin:{hueIdx:0,sat:50,light:0},eyes:{}},hairLinked:{back1:true},flipped:{}};
 const saved={tintColor:{fronthair:{color:'#123456',gradientColor:'#abcdef'},skin:{color:'#a87654'}},hairLinked:{back1:false}};
 const code=section('function applyFullState(', 'function tryLoadDraft(');
 const context={state,PARTS:[],HUE_PALETTE:[{}],saved};runInNewContext(code+';applyFullState(saved);',context);
 expect(state.tintColor.fronthair).toMatchObject(saved.tintColor.fronthair);expect(state.tintColor.skin.color).toBe('#a87654');expect(state.hairLinked.back1).toBe(false);
 runInNewContext(code+`;applyFullState({tintColor:{fronthair:{color:'bad',gradientColor:'url(x)'}}});`,context);
 expect(state.tintColor.fronthair.color).toBeUndefined();expect(state.tintColor.fronthair.gradientColor).toBeUndefined();
});
