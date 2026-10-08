import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudDataError } from './amsgCloudData';
const { session, open, config } = vi.hoisted(() => ({
  session: { workerUrl: 'https://worker.example', userId: 'user-1', prepare: vi.fn(), start: vi.fn(), listOperations: vi.fn(), getOwner: vi.fn() },
  open: vi.fn(), config: { workerUrl: 'https://worker.example', userId: 'user-1' },
}));
vi.mock('./activeMsgClient', () => ({ ActiveMsgClient: { openCloudDataSession: open } }));
vi.mock('./activeMsgStore', () => ({ ActiveMsgStore: { getGlobalConfig: async () => config } }));
import { retireCloudCharacter } from './amsgCloudRetirement';

beforeEach(() => {
  localStorage.clear(); config.workerUrl = 'https://worker.example';
  open.mockReset().mockResolvedValue(session);
  session.prepare.mockReset().mockResolvedValue({ id: 'p1', mode: 'retire-owner', owner: { type: 'character', id: 'c1', label: '小满' }, resources: [], count: 0, expiresAt: Date.now() + 60000, counts: [], impacts: [], complete: true, gaps: [] });
  session.getOwner.mockReset().mockResolvedValue({ retired: false, generation: 0, complete: true, gaps: [] });
  session.listOperations.mockReset().mockResolvedValue({ operations: [], complete: true, gaps: [] });
  session.start.mockReset().mockResolvedValue({ id: 'op1', status: 'pending', counts: [], errors: [] });
});

describe('删除角色交由云端停用和清理', () => {
  it('无需本地任务编号，云端接受后返回操作编号，不把pending称作清完', async () => {
    const result = await retireCloudCharacter({ id: 'c1', name: '小满' });
    expect(result).toMatchObject({ status: 'accepted', operationId: 'op1', completed: false });
    expect(session.prepare).toHaveBeenCalledWith({ mode: 'retire-owner', owner: { type: 'character', id: 'c1', label: '小满' } });
  });
  it('只有明确不支持才走旧路，网络失败保留为失败', async () => {
    open.mockRejectedValueOnce(new CloudDataError('CLOUD_DATA_UNSUPPORTED', '旧部署'));
    expect(await retireCloudCharacter({ id: 'c1', name: '小满' })).toMatchObject({ status: 'unsupported' });
    open.mockRejectedValueOnce(new Error('断网'));
    expect(await retireCloudCharacter({ id: 'c1', name: '小满' })).toMatchObject({ status: 'failed' });
  });
  it('执行响应丢失后重试同一计划和幂等键，不产生第二份清理', async () => {
    session.start.mockRejectedValueOnce(new Error('连接中断'));
    expect(await retireCloudCharacter({ id: 'c1', name: '小满' })).toMatchObject({ status: 'failed' });
    const firstKey = session.start.mock.calls[0][1];
    await retireCloudCharacter({ id: 'c1', name: '小满' });
    expect(session.prepare).toHaveBeenCalledTimes(1);
    expect(session.start.mock.calls[1][1]).toBe(firstKey);
  });
  it('执行失败不放行本地删除，也不会把failed当已受理', async () => {
    session.start.mockResolvedValueOnce({ id: 'op1', status: 'failed', counts: [{ type: 'state', deleted: 0, remaining: 1, failed: 1 }], errors: [{ code: 'FAIL', message: '未能清理' }] });
    expect(await retireCloudCharacter({ id: 'c1', name: '小满' })).toMatchObject({ status: 'failed' });
  });
});


it('服务端拒绝旧预览后，下次明确重试生成新计划，不循环提交失效计划', async () => {
  session.start.mockRejectedValueOnce(new CloudDataError('CLOUD_PLAN_CHANGED', '归属已变化'));
  expect((await retireCloudCharacter({ id: 'c1', name: '小满' })).status).toBe('failed');
  const oldKey = session.start.mock.calls[0][1];
  await retireCloudCharacter({ id: 'c1', name: '小满' });
  expect(session.prepare).toHaveBeenCalledTimes(2);
  expect(session.start.mock.calls[1][1]).not.toBe(oldKey);
});

it('已过期请求仅查到待处理记录时不能假定停用屏障已建立', async () => {
  session.prepare.mockResolvedValueOnce({ id: 'expired', mode: 'retire-owner', owner: { type: 'character', id: 'c1' }, resources: [], count: 0, expiresAt: 1, counts: [], impacts: [], complete: true, gaps: [] });
  session.listOperations.mockResolvedValueOnce({ operations: [{ id: 'unfenced', planId: 'expired', status: 'pending' }], complete: true, gaps: [] });
  expect((await retireCloudCharacter({ id: 'c1', name: '小满' })).status).toBe('failed');
  expect(session.start).not.toHaveBeenCalled();
});

it('服务端暂时失败但仍在重试时复用原操作，不再次停用角色', async () => {
  session.start.mockResolvedValueOnce({ id: 'op1', status: 'pending', counts: [], errors: [{ code: 'RETRY', message: '稍后重试' }] });
  expect((await retireCloudCharacter({ id: 'c1', name: '小满' })).status).toBe('failed');
  const firstKey = session.start.mock.calls[0][1];
  await retireCloudCharacter({ id: 'c1', name: '小满' });
  expect(session.prepare).toHaveBeenCalledTimes(1);
  expect(session.start.mock.calls[1][1]).toBe(firstKey);
});

it('面板仍显示旧连接时，重试不能删除刚切换的新 Worker 上的同名角色', async () => {
  config.workerUrl = 'https://new-worker.example';
  const result = await retireCloudCharacter({ id: 'c1', name: '小满' }, { workerUrl: 'https://worker.example', userId: 'user-1' });
  expect(result).toMatchObject({ status: 'failed' });
  expect(open).not.toHaveBeenCalled();
  expect(session.prepare).not.toHaveBeenCalled();
});


it('重放已完成请求时，角色若被另一设备恢复，不能再凭旧结果删除本地', async () => {
  session.start.mockRejectedValueOnce(new Error('响应丢失'));
  await retireCloudCharacter({ id: 'c1', name: '小满' });
  session.start.mockResolvedValueOnce({ id: 'op1', status: 'completed', counts: [], errors: [] });
  session.getOwner.mockResolvedValue({ retired: false, generation: 2, complete: true, gaps: [] });
  expect(await retireCloudCharacter({ id: 'c1', name: '小满' })).toMatchObject({ status: 'failed' });
});

it('完成记录与当前停用代次一致，才确认清理已完成', async () => {
  session.getOwner.mockResolvedValueOnce({ retired: false, generation: 0, complete: true, gaps: [] })
    .mockResolvedValueOnce({ retired: true, generation: 1, complete: true, gaps: [] });
  session.start.mockResolvedValueOnce({ id: 'op1', status: 'completed', counts: [], errors: [] });
  expect(await retireCloudCharacter({ id: 'c1', name: '小满' })).toMatchObject({ status: 'accepted', completed: true });
});
