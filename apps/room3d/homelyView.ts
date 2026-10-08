
/** The bubble's bottom edge stays above the hair, including its dotted tail. */
export function homeBubblePosition(anchor:{x:number;y:number;width:number;headTopY?:number},kind:'thought'|'speech') {
  const thought=kind==='thought',margin=thought?48:105;
  const x=Math.max(margin,Math.min(anchor.width-margin,anchor.x+(thought?(anchor.headTopY===undefined?38:22):0)));
  const y=anchor.headTopY===undefined?Math.max(thought?74:120,anchor.y-(thought?6:45)):anchor.headTopY-(thought?30:16);
  return {x,y};
}
/** An eye-level composition with room for the responsive chat panel. */
export function homelyFrame(width:number,height:number,chatOpen:boolean) {
  const aspect=Math.max(1,width)/Math.max(1,height);
  const viewHeight=aspect<.8?4.3:3.8;
  const viewWidth=viewHeight*aspect;
  // Portrait phones use a bottom sheet; only side panels need a horizontal offset.
  const bottomChat=width<700&&height>550;
  const chatFraction=chatOpen&&!bottomChat?(width>=700?Math.min(.42,420/width)+20/width:Math.min(.54,440/Math.max(1,width))):0;
  return {viewHeight,viewWidth,offsetX:viewWidth*chatFraction/2,offsetY:chatOpen&&bottomChat?-viewHeight*.16:0};
}
