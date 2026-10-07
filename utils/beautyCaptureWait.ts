/** Release the caller even if a browser image/font/renderer promise never settles. */
export function waitForBeautyCapture<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason instanceof Error ? signal.reason : Error('封面生成已取消，请重试'));
        const finish = () => signal.removeEventListener('abort', abort);
        task.then(value => {finish(); resolve(value);}, error => {finish(); reject(error);});
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, {once: true});
    });
}

/** Wait only for fonts actually used by this preview, not unrelated page fonts. */
export async function waitForBeautyCaptureFonts(root: HTMLElement, signal: AbortSignal): Promise<void> {
    const fonts = root.ownerDocument.fonts;
    if (!fonts?.load) return;
    const used = new Map<string, string>();
    const add = (style: CSSStyleDeclaration, text: string) => {
        if (!text.trim() || style.display === 'none' || style.visibility === 'hidden') return;
        const font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${style.fontSize || '16px'} ${style.fontFamily || 'sans-serif'}`;
        used.set(font, (used.get(font) || '') + text);
    };
    const pending: Element[] = [root];
    while (pending.length) {
        const node = pending.pop()!;
        const style = getComputedStyle(node);
        if (style.display === 'none') continue;
        pending.push(...Array.from(node.children));
        if (style.visibility === 'hidden') continue;
        const text = node instanceof HTMLTextAreaElement ? node.value || node.placeholder
            : Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent || '').join('');
        add(style, text);
        for (const pseudo of ['::before', '::after']) {
            const paint = getComputedStyle(node, pseudo);
            if (/^["']/.test(paint.content)) add(paint, paint.content.slice(1, -1));
        }
    }
    await waitForBeautyCapture(Promise.all(Array.from(used, ([font, text]) => fonts.load(font, text))), signal);
}

/** html2canvas clones its target's whole ownerDocument. Give it only our snapshot. */
export async function renderIsolatedBeautyCapture(snapshot: HTMLElement, width: number, height: number, signal: AbortSignal, scrolls: Array<[HTMLElement,number,number]> = []): Promise<HTMLCanvasElement> {
    const {default: html2canvas} = await waitForBeautyCapture(import('html2canvas'), signal);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.tabIndex = -1;
    frame.dataset.beautyCaptureFrame = '';
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;pointer-events:none`;
    document.body.append(frame);
    try {
        const isolated = frame.contentDocument;
        if (!isolated?.body) throw Error('无法创建封面绘制区域，请重试');
        isolated.documentElement.style.cssText = `margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden`;
        isolated.body.style.cssText = 'margin:0;padding:0';
        isolated.body.append(snapshot);
        for (const [element, top, left] of scrolls) {element.scrollTop = top; element.scrollLeft = left;}
        const bounds = snapshot.getBoundingClientRect();
        return await waitForBeautyCapture(html2canvas(snapshot, {
            x: 1 - bounds.left, y: 1 - bounds.top, scale: 2, width, height,
            backgroundColor: null, foreignObjectRendering: true, useCORS: true,
            imageTimeout: 8000, logging: false,
        }), signal);
    } finally {frame.remove();}
}
