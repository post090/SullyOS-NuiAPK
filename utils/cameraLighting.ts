type RGB = [number, number, number];
export interface CameraLightField { width: number; height: number; colors: Float32Array; median: number; shadows: RGB; highlights: RGB; light: { x: number; y: number; contrast: number } }
export interface CameraLightPlacement { x: number; y: number; width: number; height: number; angle: number; strength: number; aspect?: number; rim?: number; softness?: number; skinWarmth?: number }
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const linear = Float32Array.from({ length: 256 }, (_, n) => { const c = n / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const srgb = (n: number) => 255 * (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);
const luminance = (r: number, g: number, b: number) => r * 0.2126 + g * 0.7152 + b * 0.0722;

function tones(pixels: Uint8ClampedArray) {
    const histogram = new Float64Array(256);
    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const weight = pixels[i + 3] / 255;
        histogram[Math.round(luminance(linear[pixels[i]], linear[pixels[i + 1]], linear[pixels[i + 2]]) * 255)] += weight;
        total += weight;
    }
    const quantile = (q: number) => {
        let sum = 0;
        for (let i = 0; i < 256; i++) { sum += histogram[i]; if (sum >= total * q) return i / 255; }
        return 0;
    };
    return { low: quantile(0.1), median: quantile(0.5), high: quantile(0.9) };
}

/** 低频光色场：分开统计暗部/亮部，截掉极端亮点，再做宽核模糊，避免把背景纹理印到角色上。 */
export function analyzeCameraLight(pixels: Uint8ClampedArray, width: number, height: number): CameraLightField {
    const stats = tones(pixels), colors = new Float32Array(width * height * 3);
    const shadows: RGB = [0, 0, 0], highlights: RGB = [0, 0, 0];
    let darkWeight = 0, brightWeight = 0;
    let lightX = 0, lightY = 0, lightWeight = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const rgb = [linear[pixels[i]], linear[pixels[i + 1]], linear[pixels[i + 2]]];
        const lum = luminance(rgb[0], rgb[1], rgb[2]), weight = pixels[i + 3] / 255;
        const cap = Math.min(1, Math.max(stats.high, 0.03) / Math.max(lum, 0.0001));
        const bright = Math.max(0, Math.min(lum, stats.high) - stats.median) * weight;
        lightX += ((i / 4 % width) + 0.5) / width * bright;
        lightY += (Math.floor(i / 4 / width) + 0.5) / height * bright;
        lightWeight += bright;
        for (let c = 0; c < 3; c++) {
            colors[i / 4 * 3 + c] = rgb[c] * cap;
            if (lum <= stats.median + 0.005) shadows[c] += rgb[c] * weight;
            if (lum >= stats.median && lum <= stats.high + 0.005) highlights[c] += rgb[c] * weight;
        }
        if (lum <= stats.median + 0.005) darkWeight += weight;
        if (lum >= stats.median && lum <= stats.high + 0.005) brightWeight += weight;
    }
    for (let c = 0; c < 3; c++) { shadows[c] /= darkWeight || 1; highlights[c] /= brightWeight || 1; }
    const blurred = new Float32Array(colors.length), radius = Math.max(1, Math.round(Math.min(width, height) / 8));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let weight = 0;
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
            const k = (radius + 1 - Math.abs(dx)) * (radius + 1 - Math.abs(dy));
            const index = (clamp(y + dy, 0, height - 1) * width + clamp(x + dx, 0, width - 1)) * 3;
            for (let c = 0; c < 3; c++) blurred[(y * width + x) * 3 + c] += colors[index + c] * k;
            weight += k;
        }
        for (let c = 0; c < 3; c++) blurred[(y * width + x) * 3 + c] /= weight;
    }
    return { width, height, colors: blurred, median: stats.median, shadows, highlights, light: { x: lightWeight ? lightX / lightWeight : 0.5, y: lightWeight ? lightY / lightWeight : 0.5, contrast: clamp((stats.high - stats.median) / (stats.high + 0.025)) } };
}

function sample(field: CameraLightField, x: number, y: number, out: Float32Array) {
    const px = clamp(x) * (field.width - 1), py = clamp(y) * (field.height - 1);
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, field.width - 1), y1 = Math.min(y0 + 1, field.height - 1);
    for (let c = 0; c < 3; c++) {
        const a = field.colors[(y0 * field.width + x0) * 3 + c] * (1 - px + x0) + field.colors[(y0 * field.width + x1) * 3 + c] * (px - x0);
        const b = field.colors[(y1 * field.width + x0) * 3 + c] * (1 - px + x0) + field.colors[(y1 * field.width + x1) * 3 + c] * (px - x0);
        out[c] = a * (1 - py + y0) + b * (py - y0);
    }
}

/** Separable Gaussian convolution; callers supply premultiplied colors to avoid dark transparent fringes. */
function gaussian(values: Float32Array, width: number, height: number, channels: number, sigma: number) {
    const radius = Math.max(1, Math.ceil(sigma * 3));
    const kernel = Float32Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
    const sum = kernel.reduce((a, b) => a + b, 0);
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
    const temp = new Float32Array(values.length), out = new Float32Array(values.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = -radius; k <= radius; k++) {
        const from = (y * width + clamp(x + k, 0, width - 1)) * channels, to = (y * width + x) * channels;
        for (let c = 0; c < channels; c++) temp[to + c] += values[from + c] * kernel[k + radius];
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = -radius; k <= radius; k++) {
        const from = (clamp(y + k, 0, height - 1) * width + x) * channels, to = (y * width + x) * channels;
        for (let c = 0; c < channels; c++) out[to + c] += temp[from + c] * kernel[k + radius];
    }
    return out;
}

/** Clamp the crop border so a half-body portrait does not acquire a glowing rectangular cut. */
function erodeMatte(matte: Float32Array, width: number, height: number, radius: number) {
    const temp = new Float32Array(matte.length), out = new Float32Array(matte.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let value = 1;
        for (let k = -radius; k <= radius; k++) value = Math.min(value, matte[y * width + clamp(x + k, 0, width - 1)]);
        temp[y * width + x] = value;
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let value = 1;
        for (let k = -radius; k <= radius; k++) value = Math.min(value, temp[clamp(y + k, 0, height - 1) * width + x]);
        out[y * width + x] = value;
    }
    return out;
}

/** Two inner contour bands: a narrow luminous core and a broader diffused wrap. */
export function cameraLightWrap(matte: Float32Array, width: number, height: number, lightX: number, lightY: number) {
    const result = new Float32Array(matte.length), distance = Math.hypot(lightX, lightY);
    if (distance < 0.01) return result;
    const radius = Math.max(1, Math.round(Math.min(width, height) * 0.025));
    const narrow = erodeMatte(matte, width, height, Math.max(1, Math.round(radius * 0.3)));
    const wide = erodeMatte(matte, width, height, radius);
    const band = Float32Array.from(matte, (a, i) => Math.max(0, a - wide[i]));
    const diffuse = gaussian(band, width, height, 1, Math.max(0.6, radius * 0.5));
    const contour = gaussian(matte, width, height, 1, Math.max(0.6, radius * 0.7));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!matte[i]) continue;
        const nx = contour[y * width + clamp(x - 1, 0, width - 1)] - contour[y * width + clamp(x + 1, 0, width - 1)];
        const ny = contour[clamp(y - 1, 0, height - 1) * width + x] - contour[clamp(y + 1, 0, height - 1) * width + x];
        const normalLength = Math.hypot(nx, ny);
        // This is the 2D silhouette normal, not an invented face/surface normal.
        const facing = normalLength > 0.0001 ? Math.max(0, (nx * lightX + ny * lightY) / (normalLength * distance)) : 0;
        result[i] = (Math.max(0, matte[i] - narrow[i]) * 0.9 + diffuse[i] * 0.55) * facing ** 0.7;
    }
    return result;
}

/** Low-resolution inflated silhouette, deliberately smoothed and without specular highlights. */
export function cameraSoftVolume(matte: Float32Array, width: number, height: number, lightX: number, lightY: number) {
    const size = 48, distance = new Float32Array(size * size);
    const lightLength = Math.hypot(lightX, lightY);
    if (lightLength < 0.01) return { size, values: distance };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / size));
        const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / size));
        distance[y * size + x] = matte[sy * width + sx] > 0.05 ? size * 2 : 0;
    }
    const horizontal = width / Math.max(width, height), vertical = height / Math.max(width, height);
    const diagonal = Math.hypot(horizontal, vertical);
    for (const reverse of [false, true]) {
        const step = reverse ? -1 : 1;
        for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
            const x = reverse ? size - 1 - xx : xx, y = reverse ? size - 1 - yy : yy;
            for (const [dx, dy, cost] of [[-step, 0, horizontal], [0, -step, vertical], [-step, -step, diagonal], [step, -step, diagonal]]) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < size && ny < size) distance[y * size + x] = Math.min(distance[y * size + x], distance[ny * size + nx] + cost);
            }
        }
    }
    const radius = Math.max(1, ...distance) * 1.15;
    const heightMap = gaussian(Float32Array.from(distance, d => Math.sqrt(Math.max(0, radius * radius - (radius - d) ** 2)) * 0.6), size, size, 1, 2.5);
    const values = new Float32Array(distance.length);
    const lx = lightX / lightLength, ly = lightY / lightLength;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const nx = (heightMap[y * size + Math.max(0, x - 1)] - heightMap[y * size + Math.min(size - 1, x + 1)]) / (2 * horizontal);
        const ny = (heightMap[Math.max(0, y - 1) * size + x] - heightMap[Math.min(size - 1, y + 1) * size + x]) / (2 * vertical);
        // A shallow side light is a style assumption, not a recovered background depth.
        values[y * size + x] = Math.max(0, (nx * lx + ny * ly + 0.15) / (Math.hypot(nx, ny, 1) * Math.hypot(1, 0.15)));
    }
    return { size, values: gaussian(values, size, size, 1, 1.5) };
}

/** Color-range selection from the unlit source, not semantic skin segmentation. */
export function cameraSkinMask(pixels: Uint8ClampedArray, width: number, height: number) {
    const selected = new Float32Array(width * height);
    for (let i = 0; i < selected.length; i++) {
        const r = pixels[i * 4] / 255, g = pixels[i * 4 + 1] / 255, b = pixels[i * 4 + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const saturation = (max - min) / Math.max(max, 0.001);
        const redLead = clamp((r - Math.max(g, b) - 0.003) / 0.025);
        const peach = clamp((g - b + 0.045) / 0.065);
        const midtones = clamp((r - 0.18) / 0.2) * clamp((0.8 - saturation) / 0.25);
        selected[i] = redLead * peach * midtones * pixels[i * 4 + 3] / 255;
    }
    // A broad soft selection allows warm spill near cheeks/neck, without enlarging the sticker alpha.
    return gaussian(selected, width, height, 1, Math.max(1, Math.min(width, height) / 35));
}

/** Pastel multiply, directional inner light wrap, then bright-pass diffusion. No generated geometry or pixels outside the matte. */
export function harmonizeCameraPixels(pixels: Uint8ClampedArray, width: number, height: number, field: CameraLightField, placement: CameraLightPlacement, sourceMedian = tones(pixels).median): Uint8ClampedArray {
    const result = new Uint8ClampedArray(pixels), strength = clamp(placement.strength);
    if (!strength) return result;
    const color = new Float32Array(3);
    sample(field, placement.x, placement.y, color);
    const centerLum = luminance(color[0], color[1], color[2]);
    const target = centerLum * 0.7 + field.median * 0.3;
    const shadowLum = luminance(...field.shadows), highlightLum = luminance(...field.highlights);
    // Bright background with dark ambient regions suggests backlight, not frontal fill.
    // This is a photographic heuristic, not a recovered 3D light direction.
    const backlight = field.light.contrast * clamp((highlightLum - 0.04) / 0.22)
        * clamp((highlightLum - shadowLum) / (highlightLum + 0.03));
    const exposure = clamp(((target + 0.012) / (sourceMedian + 0.035)) ** 0.65, 0.08, 1)
        * 2 ** (-3.5 * backlight);
    // Interpolate exposure in stops: mixing the untouched image back in sets an unwanted brightness floor.
    const appliedExposure = exposure ** strength;
    const angle = placement.angle * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const aspect = placement.aspect || 1;
    const lightX = (field.light.x - placement.x) * aspect, lightY = field.light.y - placement.y;
    const distance = Math.hypot(lightX, lightY);
    const ambient: RGB = [0, 1, 2].map(c => (color[c] + field.shadows[c]) / 2) as RGB;
    const peak = Math.max(...ambient, 0.0001);
    // Keep the environment hue but lift it toward white before multiplying.
    const pastel = ambient.map(c => 0.65 + 0.35 * c / peak);
    const lightPeak = Math.max(...field.highlights, 0.0001);
    const lightColor = field.highlights.map(c => 0.55 + 0.45 * c / lightPeak);
    const matte = Float32Array.from({ length: width * height }, (_, i) => pixels[i * 4 + 3] / 255);
    const wrap = placement.rim && distance > 0.01
        ? cameraLightWrap(matte, width, height, lightX * cos + lightY * sin, -lightX * sin + lightY * cos)
        : new Float32Array(matte.length);
    const volume = cameraSoftVolume(matte, width, height, lightX * cos + lightY * sin, -lightX * sin + lightY * cos);
    const volumeGain = field.light.contrast * clamp(highlightLum / 0.15) * 0.24;
    const shaded = new Float32Array(pixels.length), lightCore = new Float32Array(pixels.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!pixels[i + 3]) continue;
        const sx = ((x + 0.5) / width - 0.5) * placement.width, sy = ((y + 0.5) / height - 0.5) * placement.height;
        sample(field, placement.x + sx * cos - sy * sin / aspect, placement.y + sx * sin * aspect + sy * cos, color);
        const ambientLum = luminance(color[0], color[1], color[2]);
        const localPeak = Math.max(color[0], color[1], color[2], 0.0001);
        const direction = clamp(((ambientLum + 0.025) / (centerLum + 0.025)) ** 0.12, 0.85, 1);
        const localLight = clamp(ambientLum / Math.max(highlightLum, 0.025), 0, 1);
        const vx = x / Math.max(1, width - 1) * (volume.size - 1), vy = y / Math.max(1, height - 1) * (volume.size - 1);
        const x0 = Math.floor(vx), y0 = Math.floor(vy), x1 = Math.min(x0 + 1, volume.size - 1), y1 = Math.min(y0 + 1, volume.size - 1);
        const broadLight = ((volume.values[y0 * volume.size + x0] * (1 - vx + x0) + volume.values[y0 * volume.size + x1] * (vx - x0)) * (1 - vy + y0)
            + (volume.values[y1 * volume.size + x0] * (1 - vx + x0) + volume.values[y1 * volume.size + x1] * (vx - x0)) * (vy - y0)) * volumeGain;
        const edge = Math.max(0, wrap[y * width + x]) ** 1.5 * field.light.contrast * clamp(placement.rim || 0)
            * clamp(highlightLum / 0.12) * (0.3 + 0.7 * localLight) * 4;
        shaded[i + 3] = pixels[i + 3] / 255;
        for (let c = 0; c < 3; c++) {
            const original = linear[pixels[i + c]];
            const value = original * (appliedExposure * direction * pastel[c] + broadLight * lightColor[c]);
            const wrapColor = 0.65 * lightColor[c] + 0.35 * color[c] / localPeak;
            shaded[i + c] = value * shaded[i + 3];
            // Keep light energy separate and unclipped until the final composite.
            lightCore[i + c] = wrapColor * edge * shaded[i + 3];
        }
    }
    const softness = clamp(placement.softness ?? 0);
    const softened = softness ? gaussian(shaded, width, height, 4, Math.max(0.5, Math.min(width, height) / 180) * (0.7 + softness)) : shaded;
    const softCore = gaussian(lightCore, width, height, 4, Math.max(0.7, Math.min(width, height) / 100));
    const bright = new Float32Array(pixels.length);
    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = shaded[i + 3];
        if (!alpha) continue;
        const brightness = luminance(shaded[i], shaded[i + 1], shaded[i + 2]) / alpha;
        const threshold = clamp((brightness - 0.45) / 0.4);
        const weight = threshold * threshold * (3 - 2 * threshold);
        for (let c = 0; c < 3; c++) bright[i + c] = shaded[i + c] * weight * 0.28 + lightCore[i + c] * 0.4;
    }
    const glow = gaussian(bright, width, height, 4, Math.max(0.8, Math.min(width, height) / 45));
    const skinWarmth = clamp(placement.skinWarmth ?? 0.35);
    const skin = skinWarmth ? cameraSkinMask(pixels, width, height) : null;
    const warmScreen: RGB = [1, 0.32, 0.09];
    for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue;
        const inkProtection = clamp(luminance(linear[pixels[i]], linear[pixels[i + 1]], linear[pixels[i + 2]]) / 0.08);
        const skinLight = (skin?.[i / 4] ?? 0) * skinWarmth * strength * 0.24 * Math.sqrt(appliedExposure) * inkProtection;
        for (let c = 0; c < 3; c++) {
            const sharp = shaded[i + c] / shaded[i + 3];
            const soft = softened[i + c] / Math.max(softened[i + 3], 0.0001);
            const value = sharp * (1 - softness) + soft * softness;
            const uncorrected = linear[pixels[i + c]] * appliedExposure * (1 - strength) + value * strength;
            const base = 1 - (1 - uncorrected) * (1 - warmScreen[c] * skinLight);
            const lit = base + (lightCore[i + c] / shaded[i + 3] * 0.22 + softCore[i + c] * 0.78 + glow[i + c]) * strength;
            // Roll off only the added light, leaving untouched source whites unchanged.
            const shoulder = Math.max(0.75, base);
            const mapped = lit > shoulder && shoulder < 1
                ? shoulder + (1 - shoulder) * (1 - Math.exp(-(lit - shoulder) / (1 - shoulder))) : lit;
            result[i + c] = srgb(clamp(mapped));
        }
    }
    return result;
}

const photoFields = new WeakMap<HTMLCanvasElement, CameraLightField>();
const sourcePixels = new WeakMap<HTMLCanvasElement, { pixels: Uint8ClampedArray; median: number }>();
export function lightCameraSticker(source: HTMLCanvasElement, photo: HTMLCanvasElement, placement: CameraLightPlacement): HTMLCanvasElement {
    let field = photoFields.get(photo);
    if (!field) {
        const sample = document.createElement('canvas'); sample.width = sample.height = 32;
        const ctx = sample.getContext('2d')!; ctx.drawImage(photo, 0, 0, 32, 32);
        field = analyzeCameraLight(ctx.getImageData(0, 0, 32, 32).data, 32, 32); photoFields.set(photo, field);
    }
    let sourceData = sourcePixels.get(source);
    if (!sourceData) {
        const pixels = source.getContext('2d')!.getImageData(0, 0, source.width, source.height).data;
        sourceData = { pixels, median: tones(pixels).median }; sourcePixels.set(source, sourceData);
    }
    const output = document.createElement('canvas'); output.width = source.width; output.height = source.height;
    const ctx = output.getContext('2d')!, image = ctx.createImageData(output.width, output.height);
    image.data.set(harmonizeCameraPixels(sourceData.pixels, source.width, source.height, field, placement, sourceData.median));
    ctx.putImageData(image, 0, 0); return output;
}

export function trimCameraSticker(source: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = source.getContext('2d')!;
    const { width, height } = source;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    if (right < left) throw new Error('角色图像为空，请等待模型显示后再试。');
    const scale = Math.min(1, 768 / Math.max(right - left + 1, bottom - top + 1));
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round((right - left + 1) * scale)); output.height = Math.max(1, Math.round((bottom - top + 1) * scale));
    output.getContext('2d')!.drawImage(source, left, top, right - left + 1, bottom - top + 1, 0, 0, output.width, output.height);
    return output;
}
