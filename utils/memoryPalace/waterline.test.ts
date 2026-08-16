import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MEMORY_PALACE_WATERLINE,
    makeCustomMemoryPalaceWaterline,
    resolveMemoryPalaceWaterline,
} from './waterline';

describe('角色级记忆水位档位', () => {
    it('旧角色没有字段时保持历史默认 200/100', () => {
        expect(resolveMemoryPalaceWaterline(undefined)).toEqual(DEFAULT_MEMORY_PALACE_WATERLINE);
    });

    it.each([
        ['online', 200, 100],
        ['balanced', 100, 50],
        ['offline', 50, 20],
    ] as const)('%s 档解析为 %i/%i', (preset, hotZoneSize, bufferThreshold) => {
        expect(resolveMemoryPalaceWaterline({ preset })).toEqual({
            preset,
            hotZoneSize,
            bufferThreshold,
        });
    });

    it('自定义值会取整并限制在安全范围内', () => {
        expect(resolveMemoryPalaceWaterline({
            preset: 'custom',
            hotZoneSize: 9.8,
            bufferThreshold: 999,
        })).toEqual({
            preset: 'custom',
            hotZoneSize: 20,
            bufferThreshold: 200,
        });
    });

    it('创建自定义配置时保存的是归一化后的稳定数值', () => {
        expect(makeCustomMemoryPalaceWaterline(88.9, 33.4)).toEqual({
            preset: 'custom',
            hotZoneSize: 88,
            bufferThreshold: 33,
        });
    });
});
