// A reusable geometry-only knife-pleat skirt. No image textures or DOM/Three
// dependencies: the build pipeline and preview use the same coordinates.
export function pleatedSkirtData({count=20,rows=16,top=2.49,bottom=.454,bones}){
 const position=[],skinIndex=[],skinWeight=[],index=[];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 // One broad sloping sheet, then one narrow return sheet. All broad sheets
 // lean in the same direction; there are no flat shelves inside the fold.
 const profile=[0,.78],fold=[0,1],columns=count*profile.length,step=2*Math.PI/count;
 const point=(column,row)=>{
  const pleat=Math.floor(column/profile.length),part=column%profile.length,angle=(pleat+profile[part]-.39)*step,t=row/rows,y=top+(bottom-top)*t;
  const rx=.445+(.81-.445)*t,rz=.28+(.60-.28)*t;
  const depth=.006+.15*smooth((top-y)/.42),r=(1-depth*fold[part])/Math.hypot(Math.cos(angle)/rx,Math.sin(angle)/rz);
  return [Math.cos(angle)*r,y,.055+Math.sin(angle)*r];
 };
 // Separate vertices across crease lines; share them vertically within each
 // panel. This gives flat pleat faces and smooth bending along their length.
 for(let column=0;column<columns;column++){
  const base=position.length/3;
  for(let row=0;row<=rows;row++)for(const c of [column,(column+1)%columns]){
   const [x,y,z]=point(c,row);position.push(x,y,z);
   const hip=smooth((y-2)/.30),shin=(1-hip)*(1-smooth((y-1.05)/.45)),thigh=1-hip-shin,left=smooth((x+.18)/.36);
   const weights=[['hips',hip],['L_thigh',thigh*left],['R_thigh',thigh*(1-left)],['L_shin',shin*left],['R_shin',shin*(1-left)]].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=weights.reduce((s,[,w])=>s+w,0);
   for(let k=0;k<4;k++){skinIndex.push(bones[weights[k]?.[0]??'hips']);skinWeight.push((weights[k]?.[1]??0)/sum);}
  }
  for(let row=0;row<rows;row++){const i=base+row*2;index.push(i,i+1,i+3,i,i+3,i+2);}
 }
 return {position,skinIndex,skinWeight,index};
}
