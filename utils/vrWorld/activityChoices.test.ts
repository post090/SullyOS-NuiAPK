import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../types';
import { ORDINARY_ACTIVITIES, SAR_ACTIVITIES, rollSARActivity, sarActivityPool } from './activityChoices';
import { rollRoom } from './runSession';
import { VRScheduler } from './scheduler';
import { withLatestVRParticipation } from './participation';

const char=(state:Record<string,unknown>={}):CharacterProfile=>({id:'choices',vrState:{enabled:true,intervalMinutes:120,...state}} as CharacterProfile);
beforeEach(()=>{
    vi.stubGlobal('document',{visibilityState:'hidden',addEventListener(){},removeEventListener(){}});
    vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
});
afterEach(()=>{VRScheduler.onTrigger(()=>{});vi.unstubAllGlobals();});

describe('自由活动排除',()=>{
    it('禁用普通房间后从候选池移除，而不是重新掷骰子补偿',()=>{
        const c=char({excludedAutoRooms:['guestbook','gym','postoffice','sar']});
        for(let i=0;i<100;i++)expect(rollRoom(c,[],null,undefined,()=>i/100)).toBe('theater');
    });
    it('整间 SAR 禁用，连同全部子活动排除',()=>{
        const c=char({excludedAutoRooms:['sar']});
        expect(sarActivityPool(c,true)).toEqual([]);
        for(let i=0;i<100;i++)expect(rollRoom(c,[],null,undefined,()=>i/100)).not.toBe('sar');
    });
    it('只留某个 SAR 子活动，随机值再大也不会落入禁用活动',()=>{
        for(const keep of SAR_ACTIVITIES){
            const c=char({excludedAutoSARActivities:SAR_ACTIVITIES.filter(a=>a.id!==keep.id).map(a=>a.id)});
            for(const random of [0,.2,.5,.9,1,NaN])expect(rollSARActivity(c,true,false,undefined,()=>random)).toBe(keep.id);
        }
    });
    it('只留箱庭但箱庭不可用时，SAR 不进入房间池',()=>{
        const c=char({excludedAutoSARActivities:SAR_ACTIVITIES.filter(a=>a.id!=='garden').map(a=>a.id)});
        expect(sarActivityPool(c,false)).toEqual([]);
        expect(rollRoom(c,[],null,undefined,()=>.999)).not.toBe('sar');
    });
    it('全部禁用返回 null，不回退且不消费随机数',()=>{
        const c=char({excludedAutoRooms:[...ORDINARY_ACTIVITIES.map(a=>a.id),'sar']});
        const random=vi.fn(()=>.5);
        expect(rollRoom(c,[],null,undefined,random)).toBeNull();expect(random).not.toHaveBeenCalled();
        expect(rollSARActivity(c,true)).toBeNull();
    });
    it('手动指定可绕过限制，自动 forced 调用仍受约束',()=>{
        const c=char({excludedAutoRooms:['sar','gym'],excludedAutoSARActivities:['cabinet','module-shop']});
        expect(rollRoom(c,[],null,'gym',Math.random,{manual:true})).toBe('gym');
        expect(rollRoom(c,[],null,'gym',Math.random,{manual:false})).toBeNull();
        expect(rollRoom(c,[],null,'sar',Math.random,{manual:true})).toBe('sar');
        for(const a of SAR_ACTIVITIES)expect(rollSARActivity(c,false,true,a.id)).toBe(a.id);
        expect(rollSARActivity(c,true,false,'cabinet')).toBeNull();
    });
    it('旧档未设置限制时保留原有 SAR 概率',()=>{
        const sample=(garden:boolean)=>Array.from({length:100},(_,i)=>rollSARActivity(char(),garden,false,undefined,()=>(i+.5)/100));
        for(const [id,count] of Object.entries({fishing:30,market:20,'module-shop':21,cabinet:29}))expect(sample(false).filter(a=>a===id)).toHaveLength(count);
        expect(sample(true).filter(a=>a==='garden')).toHaveLength(20);
        expect(sample(true).filter(a=>a==='module-shop')).toHaveLength(1);
    });
    it('未实现的空间和特别活动不进入普通随机池',()=>{
        for(let i=0;i<100;i++)expect(['cafe','signal']).not.toContain(rollRoom(char(),[],null,undefined,()=>i/100));
    });
    it('活动落库不覆盖运行期间刚改的排除项',()=>{
        const latest=char({excludedAutoRooms:['sar'],excludedAutoSARActivities:['cabinet']});
        expect(withLatestVRParticipation(latest,{vrState:char().vrState}).vrState).toMatchObject({excludedAutoRooms:['sar'],excludedAutoSARActivities:['cabinet']});
    });
    it('手动子活动通过调度器完整传递，旧邮局参数位置保持不变',()=>{
        vi.stubGlobal('document',{visibilityState:'hidden',addEventListener(){},removeEventListener(){}});
        vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
        const trigger=vi.fn();VRScheduler.onTrigger(trigger);
        VRScheduler.triggerNow('choices','sar',undefined,'module-shop');
        expect(trigger).toHaveBeenLastCalledWith('choices','sar',undefined,true,'module-shop');
        VRScheduler.triggerNow('choices','postoffice','letter-1');
        expect(trigger).toHaveBeenLastCalledWith('choices','postoffice','letter-1',true);
    });
});
