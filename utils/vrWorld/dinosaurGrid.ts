import type { DinoPose } from './dinosaurTypes';

// Coordinates are implementation details. Both fingers and model actions use these stable cells.
export const DINO_GRID = Array.from({length:30},(_,i)=>({
  id:String.fromCharCode(65+Math.floor(i/5))+(i%5+1),
  x:(i%5-2)*1.3,
  z:+(-3.1+Math.floor(i/5)*1.25).toFixed(2),
}));
export const gridCell = (id:string) => DINO_GRID.find(c=>c.id===id);
export function snapDinoPose(p:DinoPose):DinoPose {
  if(![p.x,p.z,p.rotation].every(Number.isFinite)||Math.abs(p.x)>3.7||Math.abs(p.z)>3.9)throw new Error('请选择沙盘里的落点');
  const cell=p.slotId?gridCell(p.slotId):DINO_GRID.reduce((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?a:b);
  if(!cell)throw new Error('这个落点不存在');
  const rotation=((Math.round(p.rotation/(Math.PI/4))%8)+8)%8*Math.PI/4;
  return {x:cell.x,z:cell.z,rotation,slotId:cell.id};
}
