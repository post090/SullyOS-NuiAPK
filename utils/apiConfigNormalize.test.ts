import { describe, expect, it } from 'vitest';
import {
  normalizeApiBaseUrl,
  normalizeApiConfig,
  normalizeApiCredential,
  normalizeVisionImageQuality,
} from './apiConfigNormalize';

describe('API config normalization', () => {
  it('defaults missing or invalid image quality to original and preserves explicit choices on save/import', () => {
    for (const quality of [undefined, null, '', 'unknown']) expect(normalizeVisionImageQuality(quality)).toBe('original');
    for (const imageQuality of ['original', 'high', 'compressed'] as const) {
      const config = normalizeApiConfig({ baseUrl: '', apiKey: '', model: '', visionApi: { enabled: false, baseUrl: '', apiKey: '', model: '', imageQuality } });
      expect(config.visionApi?.imageQuality).toBe(imageQuality);
      expect(normalizeApiConfig(JSON.parse(JSON.stringify(config))).visionApi?.imageQuality).toBe(imageQuality);
    }
  });
  it('removes pasted whitespace and invisible edge characters from credentials', () => {
    expect(normalizeApiCredential(' \n\u200Bsk-example\u2060\r ')).toBe('sk-example');
  });

  it('normalizes the base URL without touching its path', () => {
    expect(normalizeApiBaseUrl('  https://api.example.com/v1///\u200B ')).toBe('https://api.example.com/v1');
  });

  it('keeps unrelated API settings intact', () => {
    expect(normalizeApiConfig({
      baseUrl: ' https://api.example.com/v1/ ',
      apiKey: '\uFEFFsk-test\u200B',
      model: ' gpt-test ',
      stream: true,
      temperature: 0.7,
      minimaxApiKey: 'mini-key',
      visionApi: {
        enabled: true,
        baseUrl: ' https://vision.example.com/v1/// ',
        apiKey: '\u200Bvision-key\u2060',
        model: ' vision-model ',
      },
    })).toEqual({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-test',
      stream: true,
      temperature: 0.7,
      minimaxApiKey: 'mini-key',
      visionApi: {
        enabled: true,
        baseUrl: 'https://vision.example.com/v1',
        apiKey: 'vision-key',
        model: 'vision-model',
        imageQuality: 'original',
      },
    });
  });
});
