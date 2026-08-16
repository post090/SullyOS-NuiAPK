import type {
    MemoryPalaceWaterlineConfig,
    MemoryPalaceWaterlinePreset,
} from '../../types';

export interface ResolvedMemoryPalaceWaterline {
    preset: MemoryPalaceWaterlinePreset;
    hotZoneSize: number;
    bufferThreshold: number;
}

export const DEFAULT_MEMORY_PALACE_WATERLINE: ResolvedMemoryPalaceWaterline = {
    preset: 'online',
    hotZoneSize: 200,
    bufferThreshold: 100,
};

export const MEMORY_PALACE_WATERLINE_PRESETS = {
    online: DEFAULT_MEMORY_PALACE_WATERLINE,
    balanced: {
        preset: 'balanced',
        hotZoneSize: 100,
        bufferThreshold: 50,
    },
    offline: {
        preset: 'offline',
        hotZoneSize: 50,
        bufferThreshold: 20,
    },
} as const satisfies Record<Exclude<MemoryPalaceWaterlinePreset, 'custom'>, ResolvedMemoryPalaceWaterline>;

export const MIN_MEMORY_HOT_ZONE_SIZE = 20;
export const MAX_MEMORY_HOT_ZONE_SIZE = 500;
export const MIN_MEMORY_BUFFER_THRESHOLD = 10;
export const MAX_MEMORY_BUFFER_THRESHOLD = 200;

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = typeof value === 'number' && Number.isFinite(value)
        ? Math.floor(value)
        : fallback;
    return Math.max(min, Math.min(max, parsed));
};

/**
 * 将角色上保存的档位解析成管线可以直接使用的两个数值。
 *
 * 兼容约定：旧角色没有 memoryPalaceWaterline 字段时永远落到当前默认 200/100，
 * 不做批量迁移，也不需要给每个旧角色补写一份相同配置。
 */
export const resolveMemoryPalaceWaterline = (
    config?: MemoryPalaceWaterlineConfig,
): ResolvedMemoryPalaceWaterline => {
    const preset = config?.preset;
    if (preset === 'balanced' || preset === 'offline' || preset === 'online') {
        return { ...MEMORY_PALACE_WATERLINE_PRESETS[preset] };
    }
    if (preset === 'custom') {
        return {
            preset: 'custom',
            hotZoneSize: clampInteger(
                config?.hotZoneSize,
                DEFAULT_MEMORY_PALACE_WATERLINE.hotZoneSize,
                MIN_MEMORY_HOT_ZONE_SIZE,
                MAX_MEMORY_HOT_ZONE_SIZE,
            ),
            bufferThreshold: clampInteger(
                config?.bufferThreshold,
                DEFAULT_MEMORY_PALACE_WATERLINE.bufferThreshold,
                MIN_MEMORY_BUFFER_THRESHOLD,
                MAX_MEMORY_BUFFER_THRESHOLD,
            ),
        };
    }
    return { ...DEFAULT_MEMORY_PALACE_WATERLINE };
};

export const makeCustomMemoryPalaceWaterline = (
    hotZoneSize: unknown,
    bufferThreshold: unknown,
): MemoryPalaceWaterlineConfig => {
    const resolved = resolveMemoryPalaceWaterline({
        preset: 'custom',
        hotZoneSize: typeof hotZoneSize === 'number' ? hotZoneSize : undefined,
        bufferThreshold: typeof bufferThreshold === 'number' ? bufferThreshold : undefined,
    });
    return {
        preset: 'custom',
        hotZoneSize: resolved.hotZoneSize,
        bufferThreshold: resolved.bufferThreshold,
    };
};
