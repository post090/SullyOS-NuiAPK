import { Application, Sprite, Texture, isWebGLSupported } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters/rgb-split';
import { TiltShiftFilter } from 'pixi-filters/tilt-shift';

export async function createCameraGpuEffects() {
    if (!isWebGLSupported()) throw new Error('WebGL unavailable');
    const app = new Application();
    await app.init({ width: 1, height: 1, preference: 'webgl', autoStart: false, sharedTicker: false, backgroundAlpha: 0, preserveDrawingBuffer: true });
    const split = new RGBSplitFilter(), tilt = new TiltShiftFilter();
    return {
        apply(source: HTMLCanvasElement, dispersion: number, miniature: number) {
            const { width, height } = source;
            app.renderer.resize(width, height);
            const texture = Texture.from(source), sprite = new Sprite(texture);
            const offset = Math.min(width, height) * .008 * dispersion;
            split.red = [-offset, 0]; split.green = [0, 0]; split.blue = [offset, 0];
            tilt.start = { x: 0, y: height * .55 }; tilt.end = { x: width, y: height * .55 };
            tilt.blur = Math.min(width, height) * .025 * miniature;
            tilt.gradientBlur = height * .35;
            sprite.filters = [ ...(miniature > 0 ? [tilt] : []), ...(dispersion > 0 ? [split] : []) ];
            app.stage.addChild(sprite);
            try {
                app.render();
                const ctx = source.getContext('2d')!;
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(app.canvas, 0, 0);
            } finally { app.stage.removeChild(sprite); sprite.destroy(); texture.destroy(true); }
        },
        destroy() { split.destroy(); tilt.destroy(); app.destroy(true, { children: true }); },
    };
}
