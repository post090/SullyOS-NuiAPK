// utils/amsgDetachedWorkers.test.ts
// 守的是「断开之后还找得回去」：清空 / 更换 Worker 地址都不再动云端那份数据，所以旧地址
// 是用户回去清理的唯一线索——本地不记的话，那台 worker 上的任务会一直跑下去，而用户连
// 该填哪个地址都不知道。
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  forgetDetachedWorker,
  readDetachedWorkers,
  rememberDetachedWorker,
} from './amsgDetachedWorkers';

const A = 'https://amsg-a.example.dev';
const B = 'https://amsg-b.example.dev';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('断开过的 Worker 备忘', () => {
  it('记下地址和断开时间，最近断开的排在前面', () => {
    rememberDetachedWorker(A);
    vi.advanceTimersByTime(1000);
    rememberDetachedWorker(B);

    expect(readDetachedWorkers().map((r) => r.url)).toEqual([B, A]);
    expect(readDetachedWorkers()[0].detachedAt).toBe(Date.now());
  });

  it('同一个地址反复断开只留最新那次', () => {
    rememberDetachedWorker(A);
    vi.advanceTimersByTime(60_000);
    rememberDetachedWorker(A);

    const records = readDetachedWorkers();
    expect(records).toHaveLength(1);
    expect(records[0].detachedAt).toBe(Date.now());
  });

  it('空地址不记（没填过地址的人没有可断开的东西）', () => {
    rememberDetachedWorker('');
    rememberDetachedWorker('   ');
    rememberDetachedWorker(undefined);

    expect(readDetachedWorkers()).toEqual([]);
  });

  it('只留最近 5 条', () => {
    for (let i = 0; i < 8; i += 1) {
      rememberDetachedWorker(`https://w${i}.example.dev`);
      vi.advanceTimersByTime(1000);
    }

    const records = readDetachedWorkers();
    expect(records).toHaveLength(5);
    expect(records[0].url).toBe('https://w7.example.dev');
  });

  it('清干净之后能划掉，划完不留空壳', () => {
    rememberDetachedWorker(A);
    forgetDetachedWorker(A);

    expect(readDetachedWorkers()).toEqual([]);
    expect(localStorage.getItem('amsg2_detached_workers_v1')).toBeNull();
  });

  it('存的内容坏了当没有，不往外抛', () => {
    localStorage.setItem('amsg2_detached_workers_v1', '{不是 JSON');
    expect(readDetachedWorkers()).toEqual([]);

    localStorage.setItem('amsg2_detached_workers_v1', '[{"url":123},{"detachedAt":1}]');
    expect(readDetachedWorkers()).toEqual([]);
  });
});
