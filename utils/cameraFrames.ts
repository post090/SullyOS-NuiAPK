export const CAMERA_FRAMES = [
    { name: '无相框', color: '', format: 'none' },
    { name: '白色相框', color: '#fffdf9', format: 'edge' },
    { name: '粉色相框', color: '#f9d5df', format: 'edge' },
    { name: '黑色相框', color: '#252525', format: 'edge' },
    { name: '迷你白', color: '#fffdf9', format: 'mini' },
    { name: '迷你樱粉', color: '#f8e0e7', format: 'mini' },
    { name: '方形白', color: '#fffdf9', format: 'square' },
    { name: '方形黑', color: '#28282c', format: 'square' },
] as const;

export function cameraFrameLayout(width: number, height: number, index: number) {
    const frame = CAMERA_FRAMES[index] || CAMERA_FRAMES[0];
    if (frame.format !== 'mini' && frame.format !== 'square') return { width, height, x: 0, y: 0, photoWidth: width, photoHeight: height, instant: false };
    const paperWidth = frame.format === 'mini' ? 54 : 72;
    const windowWidth = frame.format === 'mini' ? 46 : 62;
    const scale = Math.min(1440, Math.max(width, height)) / 86;
    const w = Math.round(paperWidth * scale), h = Math.round(86 * scale);
    const windowW = windowWidth * scale, windowH = 62 * scale;
    // Fit without cropping: never silently remove a character or sticker near the edge.
    const fit = Math.min(windowW / width, windowH / height);
    return { width: w, height: h, x: (w - width * fit) / 2, y: 5 * scale + (windowH - height * fit) / 2, photoWidth: width * fit, photoHeight: height * fit, instant: true };
}

export function drawCameraFrame(source: HTMLCanvasElement, output: HTMLCanvasElement, index: number) {
    const layout = cameraFrameLayout(source.width, source.height, index);
    const frame = CAMERA_FRAMES[index] || CAMERA_FRAMES[0];
    output.width = layout.width; output.height = layout.height;
    const ctx = output.getContext('2d')!;
    if (layout.instant) { ctx.fillStyle = frame.color; ctx.fillRect(0, 0, output.width, output.height); }
    ctx.drawImage(source, layout.x, layout.y, layout.photoWidth, layout.photoHeight);
    if (frame.format === 'edge') {
        const edge = Math.min(output.width, output.height) * .045;
        ctx.fillStyle = frame.color;
        ctx.fillRect(0, 0, output.width, edge); ctx.fillRect(0, output.height - edge * 2, output.width, edge * 2);
        ctx.fillRect(0, 0, edge, output.height); ctx.fillRect(output.width - edge, 0, edge, output.height);
    }
}
