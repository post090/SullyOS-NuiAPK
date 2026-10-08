import { beforeEach, describe, expect, it } from 'vitest';
import { captureCloudOwnerGenerations, rememberCloudOwnerGeneration, stampCloudWrite, captureCloudWriteCheck, invalidateCloudOwnerWrites } from './amsgCloudOwnerGeneration';

const connection = { workerUrl: 'https://worker.example/', userId: 'user-1' };
beforeEach(() => localStorage.clear());

describe('恢复后的云端写入代次', () => {
  it('旧请求保持原代次，新连接才取得显式恢复后的代次', () => {
    const oldClient = {};
    captureCloudOwnerGenerations(oldClient, connection);
    rememberCloudOwnerGeneration(connection, { type: 'character', id: 'c1' }, 2);
    const newClient = {};
    captureCloudOwnerGenerations(newClient, connection);
    const state = { namespace: 'amsg:char:c1', key: 'fire_pack', value: '秘密' };
    expect(stampCloudWrite(oldClient, state).ownerGeneration).toBe(0);
    expect(stampCloudWrite(newClient, state).ownerGeneration).toBe(2);
    expect(state).not.toHaveProperty('ownerGeneration');
  });

  it('写入代次按 Worker、用户和角色隔离，凭据与任务用同一代次', () => {
    rememberCloudOwnerGeneration(connection, { type: 'character', id: 'c1' }, 4);
    const client = {};
    captureCloudOwnerGenerations(client, connection);
    expect(stampCloudWrite(client, { credId: 'char:c1/instant', value: { apiKey: 'secret' } }).ownerGeneration).toBe(4);
    expect(stampCloudWrite(client, { metadata: { charId: 'c1' }, contactName: '小满' }).ownerGeneration).toBe(4);
    expect(stampCloudWrite(client, { namespace: 'amsg:char:c2' }).ownerGeneration).toBe(0);
    const other = {};
    captureCloudOwnerGenerations(other, { ...connection, userId: 'user-2' });
    expect(stampCloudWrite(other, { namespace: 'amsg:char:c1' }).ownerGeneration).toBe(0);
  });

  it('即时对话的三份信封与 job 显式归属都被标记，全局状态不受牵连', () => {
    rememberCloudOwnerGeneration(connection, { type: 'character', id: 'c1' }, 2);
    const client = {};
    captureCloudOwnerGenerations(client, connection);
    const stamped = stampCloudWrite(client, { entries: [
      { namespace: 'amsg:char:c1', key: 'fire_pack' },
      { namespace: 'amsg:global', key: 'tool_config' },
      { namespace: 'amsg:job', key: 'plate:j1', owner: { type: 'character', id: 'c1', label: '小满' } },
    ] });
    expect(stamped.entries[0]).toMatchObject({ ownerGeneration: 2 });
    expect(stamped.entries[1]).not.toHaveProperty('ownerGeneration');
    expect(stamped.entries[2]).toMatchObject({ ownerGeneration: 2 });
    expect(stampCloudWrite(client, { credentials: [{ credId: 'char:c1/chat' }] }).credentials[0]).toMatchObject({ ownerGeneration: 2 });
  });
});


it('异步初始化连接之前捕获写入意图，恢复后不能借新连接继续旧操作', () => {
  const check = captureCloudWriteCheck(['intent-character']);
  const other = captureCloudWriteCheck(['other-character']);
  invalidateCloudOwnerWrites({ type: 'character', id: 'intent-character' });
  expect(check).toThrow('发生变化');
  expect(other).not.toThrow();
  expect(captureCloudWriteCheck(['intent-character'])).not.toThrow();
});
