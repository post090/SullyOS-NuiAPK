// Let input and scrolling run between catalog thumbnails instead of building a whole grid at once.
const pending=new Set<()=>void|Promise<void>>();
let scheduled=false;
function schedule(){
 if(scheduled||!pending.size)return;
 scheduled=true;
 const run=async()=>{
  const next=pending.values().next().value;
  try{if(next){pending.delete(next);await next();}}
  finally{scheduled=false;schedule();}
 };
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
}
export function enqueuePreviewBuild(work:()=>void|Promise<void>){pending.add(work);schedule();return()=>{pending.delete(work);};}
