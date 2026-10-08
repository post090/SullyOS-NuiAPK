import {expect,it} from 'vitest';
import {findWalkPath} from '../apps/room3d/navigation.js';
import {withResidents,residentBlocksStep} from '../apps/room3d/residentNavigation.js';
const floor={free:(x:number,z:number)=>Math.abs(x)<4&&Math.abs(z)<4};
it('walks around a stationary resident without moving them',()=>{const people=[[0,0]],before=JSON.stringify(people);const path=findWalkPath(withResidents(floor,people),[-2,0],[2,0]);expect(path).not.toBeNull();for(let i=1;i<path!.length;i++)expect(residentBlocksStep(path![i-1],path![i],people)).toBe(false);expect(JSON.stringify(people)).toBe(before);});
it('stops when someone enters a planned segment, even at a long frame interval',()=>{expect(residentBlocksStep([-2,0],[2,0],[[0,0]])).toBe(true);expect(residentBlocksStep([-2,0],[-1,0],[[0,0]])).toBe(false);});
it('does not squeeze through an occupied narrow passage or move its occupant',()=>{const people=[[0,0]],map=withResidents({free:(x:number,z:number)=>Math.abs(x)<3&&Math.abs(z)<.4},people);expect(findWalkPath(map,[-2,0],[2,0])).toBeNull();expect(people).toEqual([[0,0]]);});

it('can separate an existing overlap after rising without pushing the other resident',()=>{const people=[[0,0]],path=findWalkPath(withResidents(floor,people,[.3,0]),[.3,0],[2,0]);expect(path).not.toBeNull();expect(residentBlocksStep([.3,0],[.5,0],people)).toBe(false);expect(residentBlocksStep([.3,0],[.1,0],people)).toBe(true);});

it('chooses another reachable bed entry when the nearest entry is occupied',async()=>{
 const {bedEntry}=await import('../apps/room3d/bedMotion.js');
 const seat={position:[0,0,.7],bed:{center:[0,0,0],itemRotation:0,side:1,halfWidth:1}};
 const people=[[1.55,.7]],start=[3,2],map=withResidents(floor,people,start);
 const entry=bedEntry(seat,{free:(x:number,z:number)=>map.free(x,z)&&!!findWalkPath(map,start,[x,z])});
 expect(entry).not.toBeNull();expect(Math.hypot(entry![0]-1.55,entry![2]-.7)).toBeGreaterThanOrEqual(.58);
 expect(findWalkPath(map,start,[entry![0],entry![2]])).not.toBeNull();
});
