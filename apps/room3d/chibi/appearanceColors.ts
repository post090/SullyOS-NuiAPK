import {tintIrisPixels} from './faceTint';
export type PartSurface = HTMLImageElement | HTMLCanvasElement;
export const validAppearanceColor = (value?:string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : undefined;
const cache = new WeakMap<PartSurface, Map<string, HTMLCanvasElement>>();
/** Preserve alpha, linework and painted shading; never modify the source artwork. */
export function tintAppearancePixels(pixels:Uint8ClampedArray,width:number,height:number,color:string,tip?:string) {
 if(!validAppearanceColor(tip)){tintIrisPixels(pixels,color);return;}
 const root=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),end=[1,3,5].map(i=>parseInt(tip!.slice(i,i+2),16));
 for(let y=0;y<height;y++){
  const t=Math.max(0,Math.min(1,(y/Math.max(1,height-1)-.1)/.6));
  const rowColor='#'+root.map((v,i)=>Math.round(v+(end[i]-v)*t).toString(16).padStart(2,'0')).join('');
  tintIrisPixels(pixels.subarray(y*width*4,(y+1)*width*4),rowColor);
 }
}
export function tintAppearancePart(image:PartSurface,color:string,tip?:string) {
 const key=color+'|'+(validAppearanceColor(tip)??'');
 let colors=cache.get(image);if(!colors){colors=new Map();cache.set(image,colors);}
 const hit=colors.get(key);if(hit)return hit;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=472;
 const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,472,472);
 const pixels=ctx.getImageData(0,0,472,472);tintAppearancePixels(pixels.data,472,472,color,tip);ctx.putImageData(pixels,0,0);
 if(colors.size>=8)colors.delete(colors.keys().next().value!);
 colors.set(key,canvas);return canvas;
}
