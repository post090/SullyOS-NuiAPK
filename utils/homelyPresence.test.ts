import {expect,it} from 'vitest';
import {homelyMusicPose} from '../apps/room3d/homelyPresence';
it('music adds bounded head and chest motion, with a smaller seated sway',()=>{for(let t=0;t<10;t+=.1){const p=homelyMusicPose(t,1),s=homelyMusicPose(t,1,true);expect(Math.abs(p.head[0])).toBeLessThanOrEqual(.045);expect(Math.abs(p.head[2])).toBeLessThanOrEqual(.055);expect(Math.abs(s.chest[2])).toBeLessThanOrEqual(Math.abs(p.chest[2]));expect(homelyMusicPose(t,0).head.every(v=>v===0)).toBe(true);}expect(homelyMusicPose(.6,1)).not.toEqual(homelyMusicPose(1.8,1));});
