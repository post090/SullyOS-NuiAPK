import { describe, expect, it, vi } from 'vitest';
import { canPlayLive2DAction, installLive2DIdlePolicy, live2DProceduralRestrictions } from './live2dActionPolicy';
import { buildLive2DPerformanceMix, findLive2DActionsForPerformance } from './live2dModelStore';

const action = (id: string, permission: string, extra = {}) => ({ id, permission, kind: 'motion', group: 'Idle', index: Number(id), name: id, file: id, tags: [], ...extra });
describe('Live2D runtime permissions', () => {
  it('engine random Idle selects only AI actions and reads changes immediately', async () => {
    const config = { actions: [action('0','blocked'), action('1','manual'), action('2','ai'), action('3','ai',{ wardrobe:true })] } as any;
    const manager = { startRandomMotion: vi.fn(), startMotion: vi.fn().mockResolvedValue(true) };
    installLive2DIdlePolicy(manager, () => config, () => 0);
    await manager.startRandomMotion('__sully_permission_idle__', 1, { loop:false });
    expect(manager.startMotion).toHaveBeenCalledWith('Idle', 2, 1, { loop:false });
    config.actions[2].permission = 'blocked'; manager.startMotion.mockClear();
    expect(await manager.startRandomMotion('__sully_permission_idle__',1)).toBe(false);
    expect(manager.startMotion).not.toHaveBeenCalled();
  });
  it('manual is callable only explicitly, blocked is never callable, both quality modes obey it', () => {
    const config = { actions: [action('0','blocked',{tags:['happy']}), action('1','manual',{tags:['happy']})] } as any;
    expect(canPlayLive2DAction(config,'0',true)).toBe(false);
    expect(canPlayLive2DAction(config,'1')).toBe(false);
    expect(canPlayLive2DAction(config,'1',true)).toBe(true);
    expect(findLive2DActionsForPerformance(config,{emotion:'happy',modelAction:'0'})).toEqual([]);
    expect(buildLive2DPerformanceMix(config,{emotion:'happy',modelActions:['0','1']})).toEqual({expression:undefined,motions:[],params:[]});
  });
  it('synthetic pout respects restricted model parameters and unclassified Chinese names', () => {
    const config = { actions: [action('0','blocked',{kind:'expression',name:'噘嘴'}),action('1','manual',{kind:'expression'})] } as any;
    const policy = live2DProceduralRestrictions(config, { '1':['ParamCheek'] });
    expect(policy.faces.has('pout')).toBe(true); expect(policy.faces.has('blush')).toBe(true);
    config.actions.forEach((a:any)=>a.permission='ai');
    expect(live2DProceduralRestrictions(config,{'1':['ParamCheek']}).faces.size).toBe(0);
  });
});
