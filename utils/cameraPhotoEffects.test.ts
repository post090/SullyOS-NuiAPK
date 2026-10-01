import { describe, expect, it } from 'vitest';
import { CAMERA_FILTERS, DEFAULT_CAMERA_EFFECTS, gradeCameraPixels } from './cameraPhotoEffects';

describe('camera photo effects', () => {
    const pixels = new Uint8ClampedArray([20, 40, 70, 0, 100, 150, 200, 127, 255, 250, 245, 255]);
    it('original and zero intensity preserve the exact source', () => {
        expect(gradeCameraPixels(pixels, 3, 1, DEFAULT_CAMERA_EFFECTS)).toEqual(pixels);
        expect(gradeCameraPixels(pixels, 3, 1, { ...DEFAULT_CAMERA_EFFECTS, filter: 'sakura', intensity: 0 })).toEqual(pixels);
        expect(gradeCameraPixels(pixels, 3, 1, { ...DEFAULT_CAMERA_EFFECTS, filter: 'ccd', intensity: 0 })).toEqual(pixels);
    });
    it('CCD grades shadows cool and highlights warm with deterministic texture', () => {
        const input = new Uint8ClampedArray([55,55,55,255,230,230,230,255]);
        const settings = { ...DEFAULT_CAMERA_EFFECTS, filter: 'ccd' as const, intensity: 1 };
        const result = gradeCameraPixels(input,2,1,settings);
        expect(result[2]).toBeGreaterThan(result[0]);
        expect(result[4]).toBeGreaterThan(result[6]);
        expect(gradeCameraPixels(input,2,1,settings)).toEqual(result);
    });
    it('all presets preserve alpha, transparent RGB, and input data', () => {
        for (const preset of CAMERA_FILTERS) {
            const result = gradeCameraPixels(pixels, 3, 1, { ...DEFAULT_CAMERA_EFFECTS, filter: preset.id, intensity: 1 });
            expect(result.slice(0, 4)).toEqual(pixels.slice(0, 4));
            expect([result[7], result[11]]).toEqual([127, 255]);
        }
        expect(pixels[4]).toBe(100);
    });
    it('monochrome neutralizes colors and grain is deterministic', () => {
        const mono = gradeCameraPixels(pixels, 3, 1, { ...DEFAULT_CAMERA_EFFECTS, filter: 'mono', intensity: 1 });
        expect(mono[4]).toBe(mono[5]); expect(mono[5]).toBe(mono[6]);
        const settings = { ...DEFAULT_CAMERA_EFFECTS, grain: 1 };
        expect(gradeCameraPixels(pixels, 3, 1, settings)).toEqual(gradeCameraPixels(pixels, 3, 1, settings));
    });
    it('vignette darkens corners, preserving the center', () => {
        const solid = new Uint8ClampedArray(Array.from({ length: 9 }, () => [180, 180, 180, 255]).flat());
        const result = gradeCameraPixels(solid, 3, 3, { ...DEFAULT_CAMERA_EFFECTS, vignette: 1 });
        expect(result[0]).toBeLessThan(result[16]); expect(result[16]).toBe(180);
    });
});
