export const CAMERA_FILTERS = [
    { id: 'original', name: '原色', saturation: 1, contrast: 1, warmth: 0, lift: 0 },
    { id: 'clear', name: '清透', saturation: 0.94, contrast: 0.96, warmth: -0.012, lift: 0.018 },
    { id: 'sakura', name: '樱粉', saturation: 0.9, contrast: 0.94, warmth: 0.018, lift: 0.028 },
    { id: 'sunset', name: '夕照', saturation: 0.96, contrast: 1.02, warmth: 0.055, lift: 0.008 },
    { id: 'film', name: '胶片', saturation: 0.8, contrast: 1.04, warmth: 0.022, lift: 0.035 },
    { id: 'ccd', name: 'CCD', saturation: 1.12, contrast: 1.1, warmth: 0.008, lift: 0.008 },
    { id: 'mono', name: '黑白', saturation: 0, contrast: 1.08, warmth: 0, lift: 0.006 },
] as const;
export type CameraFilterId = typeof CAMERA_FILTERS[number]['id'];
export interface CameraPhotoEffects { filter: CameraFilterId; intensity: number; bloom: number; grain: number; vignette: number }
export const DEFAULT_CAMERA_EFFECTS: CameraPhotoEffects = { filter: 'original', intensity: 0.75, bloom: 0, grain: 0, vignette: 0 };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** 确定性颗粒：同一张图的预览、重绘和导出保持一致。 */
export function gradeCameraPixels(pixels: Uint8ClampedArray, width: number, height: number, effects: CameraPhotoEffects): Uint8ClampedArray {
    const result = new Uint8ClampedArray(pixels), preset = CAMERA_FILTERS.find(f => f.id === effects.filter) || CAMERA_FILTERS[0];
    const intensity = effects.filter === 'original' ? 0 : clamp(effects.intensity);
    const ccd = effects.filter === 'ccd' ? intensity : 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!pixels[i + 3]) continue;
        const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const radius = ((x / Math.max(1, width - 1) - 0.5) ** 2 + (y / Math.max(1, height - 1) - 0.5) ** 2) * 2;
        const shade = 1 - clamp(effects.vignette + ccd * 0.12) * 0.45 * radius ** 1.4;
        let hash = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
        hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
        const noise = ((hash >>> 0) / 4294967295 - 0.5) * 0.055 * clamp(effects.grain + ccd * 0.35) * (0.35 + 0.65 * (1 - Math.abs(lum - 0.5) * 2));
        for (let c = 0; c < 3; c++) {
            const original = pixels[i + c] / 255;
            let value = lum + (original - lum) * preset.saturation;
            value = (value - 0.5) * preset.contrast + 0.5;
            value += preset.lift * (1 - value) ** 2;
            value += preset.warmth * (c === 0 ? 1 : c === 2 ? -1 : -0.12) * (1 - Math.abs(lum - 0.5));
            if (effects.filter === 'sakura' && c === 1) value -= 0.012 * (1 - lum);
            if (effects.filter === 'ccd') {
                // Compact-camera-inspired palette, not a claim to reproduce a specific sensor.
                const shadow = (1 - lum) ** 2, highlight = clamp((lum - 0.55) / 0.45);
                value += (c === 0 ? -0.018 : c === 1 ? 0.006 : 0.032) * shadow;
                value += (c === 0 ? 0.045 : c === 1 ? 0.025 : 0.008) * highlight;
            }
            result[i + c] = clamp((original + (clamp(value) - original) * intensity) * shade + noise) * 255;
        }
    }
    return result;
}

function blurGlow(input: Float32Array, width: number, height: number, radius: number): Float32Array {
    const temp = new Float32Array(input.length), output = new Float32Array(input.length);
    for (let y = 0; y < height; y++) for (let c = 0; c < 3; c++) {
        let sum = 0;
        const at = (x: number) => input[(y * width + Math.max(0, Math.min(width - 1, x))) * 3 + c];
        for (let x = -radius; x <= radius; x++) sum += at(x);
        for (let x = 0; x < width; x++) { temp[(y * width + x) * 3 + c] = sum / (radius * 2 + 1); sum += at(x + radius + 1) - at(x - radius); }
    }
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) {
        let sum = 0;
        const at = (y: number) => temp[(Math.max(0, Math.min(height - 1, y)) * width + x) * 3 + c];
        for (let y = -radius; y <= radius; y++) sum += at(y);
        for (let y = 0; y < height; y++) { output[(y * width + x) * 3 + c] = sum / (radius * 2 + 1); sum += at(y + radius + 1) - at(y - radius); }
    }
    return output;
}

/** 柔光只扩散高亮像素；纯暗背景不会因整图模糊叠加而起灰。 */
export function applyCameraPhotoEffects(canvas: HTMLCanvasElement, effects: CameraPhotoEffects): void {
    if (effects.filter === 'original' && !effects.bloom && !effects.grain && !effects.vignette) return;
    const ctx = canvas.getContext('2d')!, { width, height } = canvas;
    const image = ctx.getImageData(0, 0, width, height);
    image.data.set(gradeCameraPixels(image.data, width, height, effects)); ctx.putImageData(image, 0, 0);
    const bloom = clamp(effects.bloom + (effects.filter === 'ccd' ? clamp(effects.intensity) * 0.25 : 0));
    if (bloom <= 0) return;
    const glow = document.createElement('canvas'), scale = Math.min(1, 256 / Math.max(width, height));
    glow.width = Math.max(1, Math.round(width * scale)); glow.height = Math.max(1, Math.round(height * scale));
    const g = glow.getContext('2d')!; g.drawImage(canvas, 0, 0, glow.width, glow.height);
    const small = g.getImageData(0, 0, glow.width, glow.height), bright = new Float32Array(glow.width * glow.height * 3);
    for (let i = 0; i < small.data.length; i += 4) {
        const lum = (small.data[i] * 0.2126 + small.data[i + 1] * 0.7152 + small.data[i + 2] * 0.0722) / 255;
        const threshold = clamp((lum - 0.62) / 0.38);
        for (let c = 0; c < 3; c++) bright[i / 4 * 3 + c] = small.data[i + c] * threshold * threshold;
    }
    const blurred = blurGlow(blurGlow(bright, glow.width, glow.height, 4), glow.width, glow.height, 4);
    for (let i = 0; i < small.data.length; i += 4) { for (let c = 0; c < 3; c++) small.data[i + c] = blurred[i / 4 * 3 + c]; small.data[i + 3] = 255; }
    g.putImageData(small, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = bloom * 0.4; ctx.drawImage(glow, 0, 0, width, height); ctx.restore();
}
