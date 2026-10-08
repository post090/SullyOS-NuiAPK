import {applyEyePreset,defaultFace,composeFace,loadFaceImages,eyeStyles,faceAssets,highlightStyles} from '../../apps/room3d/chibi/faceAppearance';
import {tintIrisPixels} from '../../apps/room3d/chibi/faceTint';
const sheet=document.querySelector<HTMLCanvasElement>('#sheet')!,ctx=sheet.getContext('2d')!;
const scratch=document.createElement('canvas');scratch.width=scratch.height=472;
const pixels=(image:CanvasImageSource)=>{const c=scratch.getContext('2d')!;c.clearRect(0,0,472,472);c.drawImage(image,0,0);return c.getImageData(0,0,472,472).data;};
const cell=(image:CanvasImageSource,x:number,y:number,label:string)=>{ctx.fillStyle='#efd3bb';ctx.fillRect(x*240,y*140,240,140);ctx.drawImage(image,115,225,240,100,x*240,y*140,240,100);ctx.fillStyle='#493d43';ctx.font='14px sans-serif';ctx.fillText(label,x*240+8,y*140+124);};
let checks=0,samples=0,occluded=0;
try{
 for(const [index,eye] of eyeStyles.entries()){
  const preset=applyEyePreset(defaultFace,eye),highlight=highlightStyles[index];
  const images=await loadFaceImages({...preset,highlight});
  cell(images[`original-${eye}`],index,0,`${eye} · 原始灰度`);
  cell(composeFace(preset,images).eyes,index,1,`${eye} · 原款染色`);
  cell(composeFace({...preset,highlight},images).eyes,index,2,`${eye} · 拆分＋高光 ${index+1}`);
  cell(composeFace({...preset,highlight},images,'half').eyes,index,3,`${eye} · 半睁原位置`);
  for(const state of ['open','half'] as const){
   const before=composeFace({...preset,brow:'none',lower:'none',highlight:'none'},images,state).eyes;
   const after=composeFace({...preset,brow:'none',lower:'none',highlight},images,state).eyes;
   const a=pixels(before),b=pixels(after),mask=pixels(images[`highlight-${highlight}`]);let changed=0;
   for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){
    if(!mask[i+3]&&[0,1,2].some(k=>Math.abs(a[i+k]-b[i+k])>1))throw Error(`${eye}/${state}: highlight left its authored coordinates at ${i/4%472},${Math.floor(i/4/472)}: ${a.slice(i,i+4)} / ${b.slice(i,i+4)}`);
    changed++;
   }
   if(state==='open'&&changed<5)throw Error(`${eye}: white highlight is absent`);
   checks++;
  }
  // Every upper-lash style, state and manual move must leave the iris's
  // visible source pixels in place. This also covers the previous 06/07 drift.
  for(const upper of eyeStyles)for(const state of ['open','half'] as const)for(const y of [0,-7]){
   const settings={...preset,upper,brow:'none',lower:'none',highlight:'none',adjustments:{upper:{y}}};
   const loaded=await loadFaceImages(settings),source=pixels(loaded[`iris-${eye}-${state}`]);
   const upperPixels=pixels(loaded[`upper-${upper}-${state}`]);
   const expected=source.slice();tintIrisPixels(expected,settings.irisColor);
   const actual=pixels(composeFace(settings,loaded,state).eyes),lash=faceAssets[`upper-${upper}-${state}`].sides!;
   let checked=0;
   for(const side of lash)for(let x=side.left+2;x<side.right-2;x++)for(let yy=Math.ceil(side.edge[x-side.left]+y+1);yy<350;yy++){
    const i=(yy*472+x)*4;
    if(source[i+3]!==255||upperPixels[((yy-y)*472+x)*4+3])continue;
    if(actual[i+3]!==255||[0,1,2].some(k=>Math.abs(actual[i+k]-expected[i+k])>1))throw Error(`${upper}/${eye}/${state}/${y}: source pixel moved or changed dye at ${x},${yy}`);
    checked++;
   }
   // Some mixed half-closed lids cover the small iris completely. Native
   // placement intentionally leaves it covered instead of moving it down.
   if(checked<5){if(state==='open'||upper===eye)throw Error(`${upper}/${eye}/${state}: insufficient visible test pixels`);occluded++;}
   samples+=checked;checks++;
  }
 }
 document.querySelector('#result')!.textContent=`通过：${checks} 项原位置检查，${samples} 个可见眼珠像素；六款白色高光未自动移动。`;
}catch(error){document.querySelector('#result')!.textContent=String(error);throw error;}
(window as any).render_game_to_text=()=>JSON.stringify({result:document.querySelector('#result')!.textContent,checks,samples,occluded});
