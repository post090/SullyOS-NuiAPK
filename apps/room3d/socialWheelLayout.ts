export function socialWheelLayout(x:number,y:number,width:number,height:number,count:number){
 const radius=height<560?88:96,margin=radius+44;
 const edge=x<margin?'left':x>width-margin?'right':y<margin+60?'top':y>height-margin-90?'bottom':null;
 const middle=edge==='left'?0:edge==='right'?180:edge==='top'?90:-90;
 const points=Array.from({length:count},(_,i)=>{const angle=(edge?middle-85+(count===1?85:i*170/(count-1)):-90+i*360/count)*Math.PI/180;return {x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius};});
 const all=[{x,y},...points],xs=all.map(p=>p.x),ys=all.map(p=>p.y);
 const dx=Math.max(46-Math.min(...xs),Math.min(0,width-46-Math.max(...xs)));
 const top=height<560?52:96,bottom=height<560?100:220;
 const dy=Math.max(top-Math.min(...ys),Math.min(0,height-bottom-Math.max(...ys)));
 return {center:{x:x+dx,y:y+dy},points:points.map(p=>({x:p.x+dx,y:p.y+dy})),edge};
}

