// 「点预设 = 立刻切过去」的口径守卫。
//
// 为什么值得钉：这块出过的问题全是静默的——界面高亮着 B、请求发去 A，或者切了一下
// 温度被顺手重置。都不报错，只有对着账单或输出风格才看得出来。
import { describe, expect, it } from 'vitest';

import type { APIConfig, ApiPreset } from '../types';
import { configFromPreset, findActivePresetId, presetDiffersFromConfig, presetMatchesConfig } from './apiPresetSwitch';

const preset = (id: string, config: Partial<APIConfig>): ApiPreset => ({
  id,
  name: `preset-${id}`,
  config: { baseUrl: '', apiKey: '', model: '', ...config } as APIConfig,
});

describe('configFromPreset', () => {
  it('带上三件套并归一化（末尾斜杠、粘贴带进来的空格）', () => {
    const patch = configFromPreset(preset('a', {
      baseUrl: ' https://api.example.com/v1/ ',
      apiKey: ' sk-abc ',
      model: ' gpt-x ',
    }));

    expect(patch).toEqual({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-abc',
      model: 'gpt-x',
    });
  });

  it('预设没存 stream / temperature 时一个字都不带（老预设不许重置用户调过的温度）', () => {
    // 聊天面板存的预设只有三件套。旧实现在这里补 stream:false + temperature:0.85，
    // 切一次预设就把用户手调的温度打回默认。
    const patch = configFromPreset(preset('a', { baseUrl: 'https://x', model: 'm' }));

    expect('stream' in patch).toBe(false);
    expect('temperature' in patch).toBe(false);
  });

  it('预设存了就照搬，包括 false / 0 这种容易被 falsy 判定吃掉的值', () => {
    const patch = configFromPreset(preset('a', {
      baseUrl: 'https://x',
      model: 'm',
      stream: false,
      temperature: 0,
    }));

    expect(patch.stream).toBe(false);
    expect(patch.temperature).toBe(0);
  });
});

describe('findActivePresetId', () => {
  const presets = [
    preset('main', { baseUrl: 'https://a.example.com/v1', apiKey: 'sk-1', model: 'm1' }),
    // 同站同模型、只换了令牌的副号：Key 也参与比对，两条不能混为一条
    preset('backup', { baseUrl: 'https://a.example.com/v1', apiKey: 'sk-2', model: 'm1' }),
  ];

  it('认出当前生效的那条', () => {
    expect(findActivePresetId(presets, { baseUrl: 'https://a.example.com/v1', apiKey: 'sk-2', model: 'm1' }))
      .toBe('backup');
  });

  it('末尾斜杠不同不算换了一条', () => {
    expect(findActivePresetId(presets, { baseUrl: 'https://a.example.com/v1/', apiKey: 'sk-1', model: 'm1' }))
      .toBe('main');
  });

  it('手填的配置不打勾', () => {
    expect(findActivePresetId(presets, { baseUrl: 'https://other.example.com', apiKey: 'sk-1', model: 'm1' }))
      .toBeNull();
  });

  it('还没配过 API 时不打勾（别跟同样空着的预设撞上）', () => {
    expect(findActivePresetId([preset('empty', {})], { baseUrl: '', apiKey: '', model: '' })).toBeNull();
  });
});

describe('presetMatchesConfig', () => {
  it('只看三件套，温度 / 流式不参与判定', () => {
    const p = preset('a', { baseUrl: 'https://x', apiKey: 'k', model: 'm', temperature: 0.85 });

    expect(presetMatchesConfig(p, { baseUrl: 'https://x', apiKey: 'k', model: 'm' })).toBe(true);
  });
});

describe('presetDiffersFromConfig', () => {
  const base = { baseUrl: 'https://x', apiKey: 'k', model: 'm' };

  it('换了模型就算对不上', () => {
    expect(presetDiffersFromConfig(preset('a', base), { ...base, model: 'm2' })).toBe(true);
  });

  it('三件套没变、只调了温度或流式，也算对不上', () => {
    const p = preset('a', { ...base, stream: false, temperature: 0.85 });
    expect(presetDiffersFromConfig(p, { ...base, stream: false, temperature: 1.2 })).toBe(true);
    expect(presetDiffersFromConfig(p, { ...base, stream: true, temperature: 0.85 })).toBe(true);
    expect(presetDiffersFromConfig(p, { ...base, stream: false, temperature: 0.85 })).toBe(false);
  });

  it('老预设没存温度 / 流式，那两项怎么调都不算差异', () => {
    expect(presetDiffersFromConfig(preset('a', base), { ...base, stream: true, temperature: 1.5 })).toBe(false);
  });

  it('只是末尾斜杠、空格不同不算差异', () => {
    expect(presetDiffersFromConfig(preset('a', base), { ...base, baseUrl: 'https://x/', model: ' m ' })).toBe(false);
  });
});
