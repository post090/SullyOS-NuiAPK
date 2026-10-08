import {it,expect} from 'vitest';
import {homeInitiative} from './homeInitiative';
import {homeTurnMessages} from './homeTurns';
import type {HomeRecord} from '../apps/room3d/types';
const local=(id:string,at=2000):HomeRecord=>({id,at,kind:'action',source:'local',actor:'character',text:'角色走到窗边',roomId:'r',roomName:'客厅'});
it('offers only after three real local actions and elapsed threshold, respecting cooldown and room',()=>{const records=[local('a'),local('b'),local('c')];expect(homeInitiative(records,'r',100000,0,0)?.key).toBe('c');expect(homeInitiative(records.slice(0,2),'r',100000,0,0)).toBeNull();expect(homeInitiative(records,'r',80000,0,0)).toBeNull();expect(homeInitiative(records,'other',200000,0,0)).toBeNull();expect(homeInitiative(records,'r',200000,0,150000)).toBeNull();});
it('starts a new turn for post-response local actions and keeps proactive response linked',()=>{const first={...local('m',1000),kind:'message',source:'model'} as HomeRecord;const invitation={...local('invite',3000),kind:'presence',initiative:true} as HomeRecord;const answer={...first,id:'reply',at:4000,replyTo:'invite'};const rows=homeTurnMessages('c',[first,local('a'),local('b'),local('c'),invitation,answer,local('next',5000)]);expect(rows).toHaveLength(3);expect(rows[1].metadata.homeRecordIds).toEqual(['a','b','c','invite','reply']);expect(rows[2].metadata.homeRecordIds).toEqual(['next']);expect(homeInitiative([first,local('a'),local('b'),local('c'),invitation,answer],'r',999999,0,0)).toBeNull();});

