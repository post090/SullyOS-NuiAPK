import {tintIrisPairPixels} from './faceTint';
import type {PartSurface} from './appearanceColors';
import type {FaceSettings} from './faceAppearance';
const cache=new WeakMap<PartSurface,WeakMap<PartSurface,Map<string,HTMLCanvasElement>>>();
/** Dye the original source, never repeatedly recolor the already dyed 2D export. */
export function colorBaseEyes(baked:PartSurface,raw:PartSurface|undefined,face:FaceSettings){
 const colors={L:face.irisColors?.L??face.baseIrisColor,R:face.irisColors?.R??face.baseIrisColor};
 if(!colors.L&&!colors.R)return baked;
 const source=raw??baked,key=JSON.stringify(colors);
 let sources=cache.get(baked);if(!sources){sources=new WeakMap();cache.set(baked,sources);}
 let variants=sources.get(source);if(!variants){variants=new Map();sources.set(source,variants);}
 const hit=variants.get(key);if(hit)return hit;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=472;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0,472,472);
 const pixels=ctx.getImageData(0,0,472,472);tintIrisPairPixels(pixels.data,472,colors);ctx.putImageData(pixels,0,0);
 for(const [x,color] of [[0,colors.L],[236,colors.R]] as const)if(!color){ctx.clearRect(x,0,236,472);ctx.drawImage(baked,x,0,236,472,x,0,236,472);}
 if(variants.size>=8)variants.delete(variants.keys().next().value!);
 variants.set(key,canvas);return canvas;
}
