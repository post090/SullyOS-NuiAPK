import {expect,it} from 'vitest';
import type {CharacterProfile,DailySchedule} from '../types';
import {homePresence} from './homePresence';
const char={customTimezoneEnabled:true,customTimezone:'Asia/Tokyo',home3D:{rooms:[{id:'study'}]}} as CharacterProfile;
const schedule={date:'2026-10-03',slots:[
 {startTime:'08:00',homePosition:{kind:'home',roomId:'study'}},
 {startTime:'12:00',homePosition:{kind:'away'}},
 {startTime:'18:00',homePosition:{kind:'home',roomId:'deleted'}},
]} as DailySchedule;
it('uses the character clock for home and away, without guessing missing positions',()=>{
 expect(homePresence(schedule,char,new Date('2026-10-03T00:00:00Z'))).toEqual({kind:'home',roomId:'study'});
 expect(homePresence(schedule,char,new Date('2026-10-03T04:00:00Z'))).toEqual({kind:'away'});
 expect(homePresence(schedule,char,new Date('2026-10-03T10:00:00Z'))).toBeUndefined();
 expect(homePresence(schedule,char,new Date('2026-10-02T22:00:00Z'))).toBeUndefined();
 expect(homePresence(schedule,char,new Date('2026-10-04T00:00:00Z'))).toBeUndefined();
});
