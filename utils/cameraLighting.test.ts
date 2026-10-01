import { describe, expect, it } from 'vitest';
import { analyzeCameraLight, cameraLightWrap, cameraSkinMask, cameraSoftVolume, harmonizeCameraPixels, type CameraLightPlacement } from './cameraLighting';

const placement: CameraLightPlacement = { x: 0.5, y: 0.5, width: 0.8, height: 0.8, angle: 0, strength: 1 };
const field = (rgb: number[]) => analyzeCameraLight(new Uint8ClampedArray(Array.from({ length: 64 }, () => [...rgb, 255]).flat()), 8, 8);
const matchCameraLight = (pixels: Uint8ClampedArray, rgb: number[]) => harmonizeCameraPixels(pixels, pixels.length / 4, 1, field(rgb), placement);

describe('camera ambient light', () => {
    it('leaves whole-character softening off by default', () => {
        const pixels = new Uint8ClampedArray([200, 180, 160, 255, 0, 0, 0, 255, 200, 180, 160, 255]);
        const lighting = field([100, 120, 140]);
        expect(harmonizeCameraPixels(pixels, 3, 1, lighting, placement)).toEqual(
            harmonizeCameraPixels(pixels, 3, 1, lighting, { ...placement, softness: 0 }),
        );
    });
    it('soft volume follows the light side with a smooth internal falloff', () => {
        const matte = Float32Array.from({ length: 64 * 64 }, (_, i) => Math.hypot(i % 64 - 31.5, Math.floor(i / 64) - 31.5) < 24 ? 1 : 0);
        const right = cameraSoftVolume(matte, 64, 64, 1, 0), left = cameraSoftVolume(matte, 64, 64, -1, 0);
        expect(right.values[24 * 48 + 34]).toBeGreaterThan(right.values[24 * 48 + 14]);
        expect(left.values[24 * 48 + 14]).toBeGreaterThan(left.values[24 * 48 + 34]);
        expect(right.values.every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
        expect(cameraSoftVolume(matte, 64, 64, 0, 0).values.every(v => v === 0)).toBe(true);
    });
    it('selects original peach/pink skin tones, not neutral whites or purple clothing', () => {
        const mask = (rgb: number[], alpha = 255) => cameraSkinMask(new Uint8ClampedArray([...rgb, alpha]), 1, 1)[0];
        expect(mask([255, 230, 215])).toBeGreaterThan(0.5);
        expect(mask([245, 220, 224])).toBeGreaterThan(0.4);
        expect(mask([255, 255, 255])).toBe(0);
        expect(mask([120, 100, 150])).toBe(0);
        expect(mask([255, 230, 215], 0)).toBe(0);
    });
    it('screens warm color onto skin while preserving the backlit exposure and alpha', () => {
        const pixels = new Uint8ClampedArray([240, 215, 200, 160]);
        const lighting = field([30, 40, 60]);
        const cold = harmonizeCameraPixels(pixels, 1, 1, lighting, { ...placement, skinWarmth: 0 });
        const warm = harmonizeCameraPixels(pixels, 1, 1, lighting, { ...placement, skinWarmth: 1 });
        expect(warm[0]).toBeGreaterThan(cold[0]);
        expect(warm[0] - cold[0]).toBeGreaterThan(warm[2] - cold[2]);
        expect(warm[0]).toBeLessThan(180);
        expect(warm[3]).toBe(160);
        expect(harmonizeCameraPixels(pixels, 1, 1, lighting, { ...placement, skinWarmth: 1, strength: 0 })).toEqual(pixels);
    });
    it('keeps a bright light core after softening while leaving the foreground center dark', () => {
        const size = 64;
        const pixels = new Uint8ClampedArray(Array.from({ length: size * size }, (_, i) => [80, 80, 80, i % size >= 12 && i % size < 52 ? 255 : 0]).flat());
        const background = new Uint8ClampedArray(Array.from({ length: 256 }, (_, i) => i % 16 < 8 ? [25, 25, 25, 255] : [255, 235, 180, 255]).flat());
        const lighting = analyzeCameraLight(background, 16, 16);
        const base = harmonizeCameraPixels(pixels, size, size, lighting, { ...placement, strength: 0.7, rim: 0, softness: 1 });
        const lit = harmonizeCameraPixels(pixels, size, size, lighting, { ...placement, strength: 0.7, rim: 0.4, softness: 1 });
        expect(lit[(32 * size + 51) * 4]).toBeGreaterThan(200);
        expect(lit[(32 * size + 32) * 4]).toBe(base[(32 * size + 32) * 4]);
        expect(lit[(32 * size + 12) * 4]).toBe(base[(32 * size + 12) * 4]);
        for (let i = 3; i < pixels.length; i += 4) expect(lit[i]).toBe(pixels[i]);
    });
    it('wrap has a narrow core and a wider falloff on the illuminated silhouette only', () => {
        const size = 160;
        const matte = Float32Array.from({ length: size * size }, (_, i) => i % size >= 20 && i % size < 140 ? 1 : 0);
        const right = cameraLightWrap(matte, size, size, 1, 0);
        const left = cameraLightWrap(matte, size, size, -1, 0);
        const at = (x: number) => 80 * size + x;
        expect(right[at(139)]).toBeGreaterThan(right[at(136)]);
        expect(right[at(136)]).toBeGreaterThan(0.05);
        expect(right[at(80)]).toBe(0);
        expect(right[at(20)]).toBe(0);
        expect(left[at(20)]).toBeCloseTo(right[at(139)], 5);
        for (let i = 0; i < matte.length; i++) if (!matte[i]) expect(right[i]).toBe(0);
        expect(cameraLightWrap(matte, size, size, 0, 0).every(value => value === 0)).toBe(true);
    });
    it('dims in dark scenes, preserves alpha and original pixels', () => {
        const pixels = new Uint8ClampedArray([200, 180, 160, 127, 20, 40, 60, 0]);
        const result = matchCameraLight(pixels, [15, 15, 15]);
        expect(result[0]).toBeLessThan(120);
        expect(result[3]).toBe(127); expect(result[7]).toBe(0);
        expect(pixels[0]).toBe(200);
    });
    it('warms and cools neutral colors without changing transparency', () => {
        const pixels = new Uint8ClampedArray([150, 150, 150, 255]);
        const warm = matchCameraLight(pixels, [200, 150, 100]);
        const cool = matchCameraLight(pixels, [100, 150, 200]);
        expect(warm[0]).toBeGreaterThan(warm[2]);
        expect(cool[2]).toBeGreaterThan(cool[0]);
        expect(warm[3]).toBe(255);
        expect([...matchCameraLight(pixels, [0, 0, 0])].every(Number.isFinite)).toBe(true);
    });
    it('zero strength and transparent pixels are exact, diffusion keeps black linework near black', () => {
        const pixels = new Uint8ClampedArray([0, 0, 0, 255, 250, 240, 230, 0, 210, 200, 190, 100]);
        expect(harmonizeCameraPixels(pixels, 3, 1, field([255, 220, 190]), { ...placement, strength: 0 })).toEqual(pixels);
        const result = matchCameraLight(pixels, [255, 220, 190]);
        expect(Math.max(...result.slice(0, 3))).toBeLessThanOrEqual(3);
        expect(result[3]).toBe(255);
        expect(result.slice(4, 8)).toEqual(pixels.slice(4, 8));
        expect(result[11]).toBe(100);
    });
    it('follows broad left/right illumination and rotates it into sticker coordinates', () => {
        const background = new Uint8ClampedArray(Array.from({ length: 256 }, (_, i) => i % 16 < 10 ? [40, 50, 65, 255] : [240, 220, 190, 255]).flat());
        const lighting = analyzeCameraLight(background, 16, 16);
        const pixels = new Uint8ClampedArray(Array.from({ length: 16 }, () => [170, 170, 170, 255]).flat());
        const result = harmonizeCameraPixels(pixels, 16, 1, lighting, placement);
        const rotated = harmonizeCameraPixels(pixels, 16, 1, lighting, { ...placement, angle: 180 });
        expect(result[15 * 4]).toBeGreaterThan(result[0]);
        expect(rotated[0]).toBeGreaterThan(rotated[15 * 4]);
        expect(lighting.light.x).toBeGreaterThan(0.5);
    });
    it('isolated bright pixels do not become a strong fake light source', () => {
        const pixels = new Uint8ClampedArray(Array.from({ length: 256 }, () => [30, 30, 30, 255]).flat());
        pixels.set([255, 255, 255, 255], 0);
        const lighting = analyzeCameraLight(pixels, 16, 16);
        expect(lighting.light.contrast).toBe(0);
    });
    it('rim light follows the brighter side of the background and never expands alpha', () => {
        const background = new Uint8ClampedArray(Array.from({ length: 256 }, (_, i) => i % 16 < 10 ? [30, 30, 30, 255] : [250, 220, 180, 255]).flat());
        const lighting = analyzeCameraLight(background, 16, 16);
        const pixels = new Uint8ClampedArray(Array.from({ length: 81 }, (_, i) => [100, 100, 100, i % 9 >= 2 && i % 9 <= 6 && Math.floor(i / 9) >= 2 && Math.floor(i / 9) <= 6 ? 255 : 0]).flat());
        const base = harmonizeCameraPixels(pixels, 9, 9, lighting, placement);
        const rim = harmonizeCameraPixels(pixels, 9, 9, lighting, { ...placement, rim: 1 });
        expect(rim[(4 * 9 + 6) * 4]).toBeGreaterThan(base[(4 * 9 + 6) * 4]);
        expect(rim[(4 * 9 + 2) * 4] - base[(4 * 9 + 2) * 4]).toBeLessThanOrEqual(2);
        for (let i = 3; i < pixels.length; i += 4) expect(rim[i]).toBe(pixels[i]);
    });
    it('pastel multiply does not brighten a neutral flat foreground', () => {
        const pixels = new Uint8ClampedArray([150, 150, 150, 255]);
        const result = matchCameraLight(pixels, [255, 220, 100]);
        for (let c = 0; c < 3; c++) expect(result[c]).toBeLessThanOrEqual(pixels[c]);
        expect(result[0]).toBeGreaterThan(result[2]);
    });
    it('darkens the front under strong background light, including at default strength', () => {
        const background = new Uint8ClampedArray(Array.from({ length: 256 }, (_, i) => i % 16 < 8 ? [40, 35, 25, 255] : [255, 235, 190, 255]).flat());
        const pixels = new Uint8ClampedArray([240, 240, 240, 255]);
        const lighting = analyzeCameraLight(background, 16, 16);
        const result = harmonizeCameraPixels(pixels, 1, 1, lighting, { ...placement, strength: 0.7 });
        const full = harmonizeCameraPixels(pixels, 1, 1, lighting, placement);
        expect(result[0]).toBeLessThan(170);
        expect(full[0]).toBeLessThan(result[0]);
        const flat = harmonizeCameraPixels(pixels, 1, 1, field([235, 235, 235]), placement);
        expect(flat[0]).toBeGreaterThan(210);
    });
    it('does not mistake an opaque cropped canvas edge for a lightable silhouette', () => {
        const background = new Uint8ClampedArray(Array.from({ length: 256 }, (_, i) => i < 160 ? [30, 30, 30, 255] : [250, 220, 180, 255]).flat());
        const lighting = analyzeCameraLight(background, 16, 16);
        const pixels = new Uint8ClampedArray(Array.from({ length: 81 }, () => [100, 100, 100, 255]).flat());
        const base = harmonizeCameraPixels(pixels, 9, 9, lighting, { ...placement, rim: 0 });
        const rim = harmonizeCameraPixels(pixels, 9, 9, lighting, { ...placement, rim: 1 });
        expect(rim).toEqual(base);
    });
    it('softening reduces line contrast without leaking hidden transparent colors', () => {
        const pixels = new Uint8ClampedArray(Array.from({ length: 81 }, (_, i) => {
            const x = i % 9;
            return x < 2 || x > 6 ? [255, 0, 0, 0] : x === 4 ? [0, 0, 0, 255] : [120, 120, 120, 255];
        }).flat());
        const lighting = field([180, 180, 180]);
        const sharp = harmonizeCameraPixels(pixels, 9, 9, lighting, { ...placement, softness: 0 });
        const soft = harmonizeCameraPixels(pixels, 9, 9, lighting, { ...placement, softness: 1 });
        expect(soft[(4 * 9 + 4) * 4]).toBeGreaterThan(sharp[(4 * 9 + 4) * 4]);
        for (let i = 0; i < pixels.length; i += 4) {
            expect(soft[i + 3]).toBe(pixels[i + 3]);
            if (pixels[i + 3]) expect(soft[i]).toBe(soft[i + 1]);
            else expect(soft.slice(i, i + 4)).toEqual(pixels.slice(i, i + 4));
        }
    });
});
