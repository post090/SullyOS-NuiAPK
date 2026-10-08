// Shared rigid hand/spoon trajectory. No hand scaling or geometry deformation.
export function eatingHand(rest,time,side){
 if(side<0)return [rest[0],rest[1]+Math.sin(time*3)*.007,rest[2]];
 const phase=time%2.8,lift=phase<1.05?Math.sin(phase/1.05*Math.PI/2):phase<1.55?1:phase<2.35?Math.cos((phase-1.55)/.8*Math.PI/2):0;
 return rest.map((v,i)=>v+([.12,.85,.47][i]-v)*lift);
}
