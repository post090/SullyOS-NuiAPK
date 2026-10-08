/** Gentle playback-clock motion, not an audio beat or melody detector. */
export function homelyMusicPose(seconds:number,weight:number,seated=false) {
  const sway=Math.sin(seconds*Math.PI*2/2.4)*weight;
  const nod=(.5+.5*Math.sin(seconds*Math.PI*2/1.2))*weight;
  return {head:[.045*nod,0,.055*sway],chest:[0,0,(seated?.018:.035)*sway]};
}


/** Aim just inside the real panel edge, so the face visibly overlaps the UI. */
export function homelyPeekTarget(panel:{left:number;top:number;width:number;height:number}) {
 return {x:panel.left+Math.min(32,panel.width*.09),y:panel.top+Math.min(230,Math.max(100,panel.height*.34))};
}
