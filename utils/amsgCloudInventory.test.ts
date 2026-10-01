// utils/amsgCloudInventory.test.ts
// 守的是「看得见」这件事本身：清点要能把三条线索合起来，一条断了不拖累另外两条，
// 而且断了要如实说出来——把一份残缺的清单当全集，用户就会照着它误判「本地有、云端
// 没有」，反过来把还在用的东西当成干净的。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./activeMsgClient', () => ({
  ActiveMsgClient: {
    listAllTasks: vi.fn(),
    listLlmCredentials: vi.fn(),
    listCloudNamespaces: vi.fn(),
  },
}));

import {
  collectCloudInventory,
  formatCloudSize,
  isEmptyEntry,
  parseCharNamespace,
} from './amsgCloudInventory';
import { ActiveMsgClient } from './activeMsgClient';
import type { CharacterProfile } from '../types';

const char = (id: string, name: string): CharacterProfile =>
  ({ id, name } as CharacterProfile);

const tasksMock = () => vi.mocked(ActiveMsgClient.listAllTasks);
const credsMock = () => vi.mocked(ActiveMsgClient.listLlmCredentials);
const nsMock = () => vi.mocked(ActiveMsgClient.listCloudNamespaces);

beforeEach(() => {
  tasksMock().mockReset().mockResolvedValue([]);
  credsMock().mockReset().mockResolvedValue([]);
  nsMock().mockReset().mockResolvedValue([]);
});

describe('云端清点', () => {
  it('三条线索合成一行：任务数、凭据用途、上下文占用', async () => {
    tasksMock().mockResolvedValue([
      { uuid: 'u1', charId: 'char-1', messageSubtype: 'chat' },
      { uuid: 'u2', charId: 'char-1', messageSubtype: 'chat' },
      { uuid: 'u3', charId: 'char-1', messageSubtype: 'instant-chat' },
    ]);
    credsMock().mockResolvedValue([
      { credId: 'char:char-1/chat' },
      { credId: 'char:char-1/instant' },
      { credId: 'global/weather' },
    ]);
    nsMock().mockResolvedValue([
      { namespace: 'amsg:char:char-1', entryCount: 3, byteSize: 40960, updatedAt: 111 },
    ]);

    const { live, orphans } = await collectCloudInventory([char('char-1', '小明')]);

    expect(orphans).toHaveLength(0);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      charId: 'char-1',
      local: { name: '小明' },
      taskCount: 2,
      // 即时对话那行不是残留，是用户此刻正等着的一轮，单独数
      instantCount: 1,
      credPurposes: ['chat', 'instant'],
      state: { entryCount: 3, byteSize: 40960, updatedAt: 111 },
    });
  });

  it('本地没有的角色进孤儿堆，本地有的进在用堆', async () => {
    tasksMock().mockResolvedValue([{ uuid: 'u1', charId: 'char-gone', messageSubtype: 'chat' }]);
    nsMock().mockResolvedValue([
      { namespace: 'amsg:char:char-live', entryCount: 1, byteSize: 100, updatedAt: null },
    ]);

    const { live, orphans } = await collectCloudInventory([char('char-live', '还在')]);

    expect(live.map((e) => e.charId)).toEqual(['char-live']);
    expect(orphans.map((e) => e.charId)).toEqual(['char-gone']);
  });

  // 这条是这个界面的理由：没排过任务、没配过单独 API 的角色，只在 client_state 里留了
  // 一份上下文。任务表和凭据表都问不到它，只有命名空间清单看得见。
  it('只在云端留了上下文的角色也能被发现', async () => {
    nsMock().mockResolvedValue([
      { namespace: 'amsg:char:char-ghost', entryCount: 2, byteSize: 32768, updatedAt: 1 },
    ]);

    const { orphans } = await collectCloudInventory([]);

    expect(orphans.map((e) => e.charId)).toEqual(['char-ghost']);
    expect(orphans[0].state?.byteSize).toBe(32768);
  });

  it('全局命名空间不摊到角色头上', async () => {
    nsMock().mockResolvedValue([
      { namespace: 'amsg:global', entryCount: 3, byteSize: 900, updatedAt: 1 },
      { namespace: 'amsg:job', entryCount: 1, byteSize: 500, updatedAt: 2 },
      { namespace: 'amsg:char:char-1', entryCount: 1, byteSize: 100, updatedAt: 3 },
    ]);

    const { globals, orphans } = await collectCloudInventory([]);

    expect(globals.map((g) => g.namespace)).toEqual(['amsg:global', 'amsg:job']);
    expect(orphans).toHaveLength(1);
  });

  // 换过主密钥之后旧密文解不开，任务清单必然最先炸——而那正是最需要看见云端还剩什么
  // 的时候。一条断了另外两条要照常出结果。
  it('任务清单读不到，凭据和命名空间照样出结果，并把缺口说出来', async () => {
    tasksMock().mockRejectedValue(new Error('decryption failed'));
    credsMock().mockResolvedValue([{ credId: 'char:char-1/chat' }]);
    nsMock().mockResolvedValue([
      { namespace: 'amsg:char:char-1', entryCount: 1, byteSize: 200, updatedAt: 1 },
    ]);

    const { orphans, gaps } = await collectCloudInventory([]);

    expect(orphans).toHaveLength(1);
    expect(orphans[0].credPurposes).toEqual(['chat']);
    expect(gaps).toEqual([{ kind: 'tasks', message: 'decryption failed' }]);
  });

  it('老 worker 给不出命名空间清单时，清单照出但标明不是全集', async () => {
    tasksMock().mockResolvedValue([{ uuid: 'u1', charId: 'char-1', messageSubtype: 'chat' }]);
    nsMock().mockRejectedValue(new Error('这台 Worker 还没有「列出云端命名空间」的能力'));

    const { orphans, gaps } = await collectCloudInventory([]);

    expect(orphans[0].taskCount).toBe(1);
    // 问不到 ≠ 没有，所以是 null 而不是 0
    expect(orphans[0].state).toBeNull();
    expect(gaps.map((g) => g.kind)).toEqual(['namespaces']);
  });

  it('占用大的排前面，问不到大小时按任务数排', async () => {
    tasksMock().mockResolvedValue([
      { uuid: 'a', charId: 'char-a', messageSubtype: 'chat' },
      { uuid: 'b', charId: 'char-b', messageSubtype: 'chat' },
      { uuid: 'c', charId: 'char-b', messageSubtype: 'chat' },
    ]);
    nsMock().mockRejectedValue(new Error('nope'));

    const { orphans } = await collectCloudInventory([]);

    expect(orphans.map((e) => e.charId)).toEqual(['char-b', 'char-a']);
  });

  it('不认识形状的 credId 不当角色', async () => {
    credsMock().mockResolvedValue([
      { credId: 'global/weather' },
      { credId: '乱七八糟' },
    ]);

    const { live, orphans } = await collectCloudInventory([]);

    expect(live).toHaveLength(0);
    expect(orphans).toHaveLength(0);
  });
});

describe('小工具', () => {
  it('parseCharNamespace 只认角色命名空间', () => {
    expect(parseCharNamespace('amsg:char:char-1')).toBe('char-1');
    expect(parseCharNamespace('amsg:global')).toBeNull();
    expect(parseCharNamespace('amsg:char:')).toBeNull();
  });

  it('isEmptyEntry：四样都没有才算空', () => {
    const base = { charId: 'c', local: null, taskCount: 0, instantCount: 0, credPurposes: [], state: null };
    expect(isEmptyEntry(base)).toBe(true);
    expect(isEmptyEntry({ ...base, taskCount: 1 })).toBe(false);
    expect(isEmptyEntry({ ...base, state: { entryCount: 1, byteSize: 10, updatedAt: null } })).toBe(false);
    // 问不到大小（state 为 null）不等于有东西
    expect(isEmptyEntry({ ...base, state: { entryCount: 0, byteSize: 0, updatedAt: null } })).toBe(true);
  });

  it('formatCloudSize 换单位', () => {
    expect(formatCloudSize(512)).toBe('512 B');
    expect(formatCloudSize(32768)).toBe('32.0 KB');
    expect(formatCloudSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
