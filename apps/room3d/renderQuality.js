// Desktop Clear also supersamples 1× monitors. A device-pixel-ratio cap alone
// left those displays rendering the same number of pixels as Balanced.
export function roomPixelRatio(quality,deviceRatio,coarse=false){
 const dpr=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 if(coarse)return Math.min(dpr,quality==='clear'?3:quality==='balanced'?2:1.5);
 if(quality==='clear')return 1.5;
 return Math.min(dpr,quality==='balanced'?1:.75);
}

// Keep the same daylight composition on phones; spend on one cached window
// shadow instead of a second full-scene outline pass or multiple shadow maps.
export function roomLightBudget(quality,coarse=false,overview=false){
 return {windows:overview?0:quality==='clear'&&!coarse?2:1,
  keyShadow:!overview&&!coarse&&quality!=='eco',
  shadowSize:quality==='clear'&&!coarse?2048:1024,
  outline:!overview&&!coarse&&quality!=='eco'};
}
