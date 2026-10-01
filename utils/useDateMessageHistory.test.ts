// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ DB: { getRecentMessagesByCharIdAndSource: query } }));
import { useDateMessageHistory } from './useDateMessageHistory';
let history: ReturnType<typeof useDateMessageHistory>;
let root: Root;
const rows = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => ({ id: start + i, content: String(start + i) }));
function Test({ character = 'c', encounter = 'new' }) {
  history = useDateMessageHistory(character, encounter, true);
  return null;
}
beforeEach(() => {
  query.mockReset();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement('div'));
});
afterEach(async () => { await act(async () => root.unmount()); });

it('首次 50 条，上翻使用排他游标，回复刷新保留已打开的旧记录且不重复', async () => {
  query.mockResolvedValueOnce(rows(70, 120));
  await act(async () => root.render(React.createElement(Test)));
  expect(history.messages.map(row => row.id)).toEqual(rows(71, 120).map(row => row.id));
  query.mockResolvedValueOnce(rows(20, 70));
  await act(async () => history.loadOlder());
  expect(query).toHaveBeenLastCalledWith('c', 'date', 51, 71);
  expect(history.messages).toHaveLength(100);
  query.mockResolvedValueOnce(rows(71, 121));
  await act(async () => history.refresh());
  expect(history.messages.map(row => row.id)).toEqual(rows(21, 121).map(row => row.id));
  expect(history.reachedEnd).toBe(false);
  const calls = query.mock.calls.length;
  await act(async () => root.render(React.createElement(Test)));
  expect(query).toHaveBeenCalledTimes(calls);
});

it('换角色后忽略迟到的旧请求；空历史标记终点', async () => {
  let resolve!: (rows: any[]) => void;
  query.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => root.render(React.createElement(Test)));
  query.mockResolvedValueOnce([]);
  await act(async () => root.render(React.createElement(Test, { character: 'other' })));
  await act(async () => resolve(rows(1, 10)));
  expect(history.messages).toEqual([]);
  expect(history.reachedEnd).toBe(true);
});

it('重复上翻只发一个请求，失败可重试，不清空已有记录', async () => {
  query.mockResolvedValueOnce(rows(70, 120));
  await act(async () => root.render(React.createElement(Test)));
  let reject!: (error: Error) => void;
  query.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = history.loadOlder(); void history.loadOlder(); });
  expect(query).toHaveBeenCalledTimes(2);
  await act(async () => { reject(Error('读取失败')); await pending; });
  expect(history.messages).toHaveLength(50);
  expect(history.error).toBeTruthy();
  query.mockResolvedValueOnce(rows(1, 30));
  await act(async () => history.loadOlder());
  expect(history.error).toBe('');
  expect(history.reachedEnd).toBe(true);
});
