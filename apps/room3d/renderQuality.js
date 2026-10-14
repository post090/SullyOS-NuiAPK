// Desktop Clear also supersamples 1× monitors. A device-pixel-ratio cap alone
// left those displays rendering the same number of pixels as Balanced.
// Refined doubles down: fixed 2× supersample on desktop, up to 4× density on touch.
export function roomPixelRatio(quality,deviceRatio,coarse=false){
 const dpr=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 if(coarse)return Math.min(dpr,quality==='refined'?4:quality==='clear'?3:quality==='balanced'?2:1.5);
 if(quality==='refined')return 2;
 if(quality==='clear')return 1.5;
 return Math.min(dpr,quality==='balanced'?1:.75);
}

// Keep the same daylight composition on phones; spend on one cached window
// shadow instead of a second full-scene outline pass or multiple shadow maps.
// Clear and Refined keep outlines and the key shadow everywhere: the toon
// look depends on them, and self/inter-object shadows sell the furniture.
// Eco pauses outlines entirely; Balanced keeps them on desktop only.
export function roomLightBudget(quality,coarse=false,overview=false){
 const high=quality==='refined'||quality==='clear';
 return {windows:overview?0:high&&!coarse?2:1,
  keyShadow:!overview&&quality!=='eco'&&(high||!coarse),
  shadowSize:high?2048:1024,
  outline:!overview&&(high||!coarse&&quality!=='eco')};
}
