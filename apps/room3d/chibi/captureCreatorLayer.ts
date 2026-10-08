/** Serialized into the isolated 2D creator: bake authored CSS mirrors into pixels. */
export function captureCreatorLayer(layer: HTMLElement) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=472;
 const ctx=canvas.getContext('2d')!;
 for(const drawable of layer.querySelectorAll<HTMLImageElement|HTMLCanvasElement>('img,canvas')){
  let opacity=1,mirrored=false,node:HTMLElement|null=drawable;
  while(node){
   const style=getComputedStyle(node);
   if(node!==layer)opacity*=Number(style.opacity);
   // Creator transforms are horizontal mirrors around the full 472px canvas.
   if(style.transform!=='none'&&new DOMMatrixReadOnly(style.transform).a<0)mirrored=!mirrored;
   if(node===layer)break;
   node=node.parentElement;
  }
  ctx.save();ctx.globalAlpha=opacity;
  if(mirrored){ctx.translate(472,0);ctx.scale(-1,1);}
  ctx.drawImage(drawable,0,0,472,472);ctx.restore();
 }
 return canvas;
}
