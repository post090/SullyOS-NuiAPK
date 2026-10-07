// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest';
import {renderIsolatedBeautyCapture, waitForBeautyCapture, waitForBeautyCaptureFonts} from './beautyCaptureWait';

const render = vi.hoisted(() => vi.fn());
vi.mock('html2canvas', () => ({default: render}));
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals(); render.mockReset(); document.body.replaceChildren(); delete (document as any).fonts;});

it('gives the renderer only the frozen snapshot, not other app images, styles or private content', async () => {
    document.body.innerHTML = '<img src="https://example.invalid/never.png"><style>@font-face{font-family:Other;src:url(never.woff)}</style><div>private chat</div>';
    const snapshot = document.createElement('div'); snapshot.textContent = 'synthetic preview';
    const canvas = document.createElement('canvas');
    render.mockImplementation(async (element: HTMLElement) => {
        expect(element.ownerDocument).not.toBe(document);
        expect(element.ownerDocument.body.textContent).toBe('synthetic preview');
        expect(element.ownerDocument.querySelectorAll('img,style,link')).toHaveLength(0);
        expect(document.querySelector('[data-beauty-capture-frame]')).not.toBeNull();
        return canvas;
    });
    expect(await renderIsolatedBeautyCapture(snapshot, 360, 600, new AbortController().signal)).toBe(canvas);
    expect(document.querySelector('[data-beauty-capture-frame]')).toBeNull();
    expect(document.body.textContent).toContain('private chat');
});

it('cleans up its entire isolated document on cancellation even when the renderer never settles', async () => {
    let started!: () => void;
    const didStart = new Promise<void>(resolve => {started = resolve;});
    render.mockImplementation(() => {started(); return new Promise(() => {});});
    const controller = new AbortController();
    const capture = renderIsolatedBeautyCapture(document.createElement('div'), 360, 600, controller.signal);
    const rejected = expect(capture).rejects.toThrow('绘制超时');
    await didStart;
    controller.abort(Error('绘制超时'));
    await rejected;
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
});

it('cleans up after renderer failure and can successfully retry', async () => {
    render.mockRejectedValueOnce(Error('renderer failed')).mockResolvedValueOnce(document.createElement('canvas'));
    await expect(renderIsolatedBeautyCapture(document.createElement('div'), 360, 600, new AbortController().signal)).rejects.toThrow('renderer failed');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    await renderIsolatedBeautyCapture(document.createElement('div'), 360, 600, new AbortController().signal);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
});

it('loads only preview text fonts and does not wait for the whole page font set', async () => {
    const load = vi.fn().mockResolvedValue([]);
    const ready = vi.fn(() => {throw Error('must not wait for unrelated fonts');});
    const fonts = {load, get ready() {return ready();}};
    Object.defineProperty(document, 'fonts', {configurable: true, value: fonts});
    const root = document.createElement('div'); root.innerHTML = '示例文字<div hidden><span>隐藏字体</span></div>';
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node, pseudo) => ({
        fontStyle: 'normal', fontWeight: '400', fontSize: '14px', fontFamily: 'PreviewFont',
        display: node.hasAttribute('hidden') ? 'none' : 'block', visibility: 'visible', content: pseudo ? 'none' : '',
    } as CSSStyleDeclaration));
    await waitForBeautyCaptureFonts(root, new AbortController().signal);
    expect(load).toHaveBeenCalledWith('normal 400 14px PreviewFont', '示例文字');
    expect(load).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
});

it('a stalled browser task can be cancelled without accepting a late result', async () => {
    let finish!: (value: string) => void;
    const controller = new AbortController();
    const pending = waitForBeautyCapture(new Promise<string>(resolve => {finish = resolve;}), controller.signal);
    const rejected = expect(pending).rejects.toThrow('字体加载超时');
    controller.abort(Error('字体加载超时'));
    finish('late');
    await rejected;
});
