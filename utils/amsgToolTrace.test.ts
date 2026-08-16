// utils/amsgToolTrace.test.ts
// 云端工具痕迹 → 气泡底下那行灰字。worker 传回来的是原始工具名 + 次数，翻译成人话
// 全在这一份里做，所以这里钉的都是「用户最后读到的是什么」。
import { describe, it, expect } from 'vitest';

import { formatAmsgToolTrace } from './amsgToolTrace';

describe('formatAmsgToolTrace', () => {
  it('内置工具说人话，不是把 web_search 这种内部名字甩给用户', () => {
    expect(formatAmsgToolTrace([{ name: 'web_search', count: 1 }])).toBe('搜索网页');
    expect(formatAmsgToolTrace([{ name: 'recall', count: 1 }])).toBe('读取记忆');
  });

  it('跑了几次就写几次，跑一次的不写 ×1', () => {
    expect(formatAmsgToolTrace([
      { name: 'web_search', count: 2 },
      { name: 'recall', count: 1 },
    ])).toBe('搜索网页 ×2 · 读取记忆');
  });

  // 小红书那几个工具（搜索 / 刷首页 / 点开一条）在用户眼里是同一件事。分开写就成了
  // 「读取小红书 · 读取小红书」，像是渲染出了 bug。
  it('说法一样的几个工具合并计次', () => {
    expect(formatAmsgToolTrace([
      { name: 'xhs_search', count: 1 },
      { name: 'xhs_detail', count: 2 },
    ])).toBe('读取小红书 ×3');
  });

  // MCP 工具是用户自己接进来的，只有他知道那是干嘛的，不编说法。前缀是内部拿来分流的，
  // 露给用户看就跟他在设置里填的名字对不上号了。
  it('MCP 工具剥掉内部前缀，用用户自己配的那个名字', () => {
    expect(formatAmsgToolTrace([{ name: 'mcp__get_weather', count: 1 }]))
      .toBe('get_weather');
  });

  it('没见过的工具名原样显示（宁可露个英文名，也别编一个说法）', () => {
    expect(formatAmsgToolTrace([{ name: 'brand_new_tool', count: 1 }]))
      .toBe('brand_new_tool');
  });

  // 这份数据是 worker 随推送捎回来的，老版本 worker 压根不带、字段也可能是别的形状。
  // 宁可这一行不画，也别在气泡底下渲染出 [object Object]。
  it.each([
    ['不是数组', 'web_search'],
    ['没有这个字段', undefined],
    ['空数组', []],
    ['条目没名字', [{ count: 3 }]],
    ['名字不是字符串', [{ name: 42, count: 1 }]],
    ['名字是空白', [{ name: '   ', count: 1 }]],
  ])('形状不对就整行不画：%s', (_label, raw) => {
    expect(formatAmsgToolTrace(raw)).toBe('');
  });

  it('次数缺了 / 是垃圾值时按跑过一次算，不写 ×NaN', () => {
    expect(formatAmsgToolTrace([{ name: 'recall' }])).toBe('读取记忆');
    expect(formatAmsgToolTrace([{ name: 'recall', count: 'abc' }])).toBe('读取记忆');
    expect(formatAmsgToolTrace([{ name: 'recall', count: -3 }])).toBe('读取记忆');
  });

  it('好条目和坏条目混在一起时，坏的丢掉、好的照画', () => {
    expect(formatAmsgToolTrace([
      { name: 'web_search', count: 2 },
      { name: '', count: 9 },
      null,
      { name: 'recall', count: 1 },
    ])).toBe('搜索网页 ×2 · 读取记忆');
  });
});
