/** Same grayscale → HSL rule as the original creator's applyEyesTint.
 * A color swatch supplies hue/saturation and the lightness of middle gray.
 * Both complete presets and separated irises use this before composition.
 */
export function tintIrisPixels(pixels:Uint8ClampedArray,color:string,mask?:Uint8ClampedArray){
 const [r,g,b]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,light=(max+min)/2;
 const saturation=delta===0?0:delta/(1-Math.abs(2*light-1));
 const hue=delta===0?0:60*((max===r?(g-b)/delta+(g<b?6:0):max===g?(b-r)/delta+2:(r-g)/delta+4));
 for(let i=0;i<pixels.length;i+=4){
  if(!pixels[i+3]||(mask&&!mask[i+3]))continue;
  const gray=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];
  if(gray>=235){pixels[i]=pixels[i+1]=pixels[i+2]=255;continue;}
  if(gray<=25){pixels[i]=pixels[i+1]=pixels[i+2]=0;continue;}
  const l=Math.max(5,Math.min(95,gray/255*100+(light*100-50)))/100,a=saturation*Math.min(l,1-l);
  const soft=gray<=35?(gray-25)/10:1;
  for(const [channel,n] of [0,8,4].entries()){
   const k=(n+hue/30)%12;
   pixels[i+channel]=Math.round(Math.round((l-a*Math.max(-1,Math.min(k-3,9-k,1)))*255)*soft);
  }
 }
}

/** Screen-left / screen-right, matching the 2D creator. Untouched sides stay original. */
export function tintIrisPairPixels(pixels:Uint8ClampedArray,width:number,colors:{L?:string;R?:string},mask?:Uint8ClampedArray){
 for(let start=0;start<pixels.length;start+=width*4){
  for(const [offset,end,color] of [[0,Math.floor(width/2)*4,colors.L],[Math.floor(width/2)*4,width*4,colors.R]] as const){
   if(color&&/^#[\da-f]{6}$/i.test(color))tintIrisPixels(pixels.subarray(start+offset,start+end),color,mask?.subarray(start+offset,start+end));
  }
 }
}
