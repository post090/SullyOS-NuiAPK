import {expect,it} from 'vitest';
import {buildHomeActivityContext} from './homeActivityContext';
import {ContextBuilder} from './context';
import type {CharacterProfile,UserProfile} from '../types';
const char={id:'home-events',name:'A',customTimezoneEnabled:true,customTimezone:'Asia/Tokyo',home3D:{activityLog:[{kind:'activity-start',at:Date.parse('2026-10-02T23:00:00Z'),roomId:'study',roomName:'书房',label:'直播'}]}} as CharacterProfile;
it('injects actual starts separately with the character clock, without claiming completion',async ()=>{
 const text=buildHomeActivityContext(char);
 expect(text).toContain('2026/10/3');expect(text).toContain('08:00:00');
 expect(text).toContain('书房 · 用户操作');expect(text).toContain('开始直播');expect(text).toContain('不能据此声称已经完成');
 expect((await ContextBuilder.buildCoreContext(char,{name:'U'} as UserProfile))).not.toContain(text);
 expect(buildHomeActivityContext({id:'other'} as CharacterProfile)).toBe('');
});
it('bounds context and ignores malformed imported events',()=>{
 const entry=char.home3D!.activityLog![0];
 const home3D={...char.home3D!,activityLog:[...Array(45).fill(entry),null,{...entry,at:1e30}]} as any;
 expect(buildHomeActivityContext({...char,home3D}).match(/开始直播/g)).toHaveLength(30);
});
it('does not bypass shared-history limits with a second journal injection',async ()=>{
 expect((await ContextBuilder.buildVolatileCoreState(char))).not.toContain('开始直播');
 for(const detailed of [true,false])expect((await ContextBuilder.buildCoreContext(char,{name:'U'} as UserProfile,detailed))).not.toContain('开始直播');
});
