import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const runtime = readFileSync(new URL('../public/vendor/tailwind-3.4.17.js', import.meta.url), 'utf8');
const windows: JSDOM[] = [];

async function loadRuntime() {
    const dom = new JSDOM('<html><head></head><body><div class="w-4 h-4"></div></body></html>', {
        runScripts: 'outside-only',
    });
    windows.push(dom);
    const { window } = dom;
    const observers: Array<(records: unknown[]) => Promise<void>> = [];
    // Safari can deliver the next mutation before the compiler reads its virtual
    // input. Control delivery here; keep the actual bundled compiler and CSSOM.
    window.MutationObserver = class {
        constructor(callback: (records: unknown[]) => Promise<void>) { observers.push(callback); }
        observe() {}
        disconnect() {}
    } as any;
    window.console.warn = () => {}; // Upstream's expected Play CDN production warning.
    window.eval(runtime);
    const notify = () => observers[0]([]);
    await notify();
    const rule = (selector: string) => Array.from(window.document.styleSheets)
        .flatMap(sheet => Array.from(sheet.cssRules))
        .find((entry: any) => entry.selectorText === selector) as CSSStyleRule | undefined;
    return { window, notify, rule, stylesChanged: () => observers[1]([]) };
}

afterEach(() => {
    windows.splice(0).forEach(dom => dom.window.close());
});

describe('bundled Tailwind runtime', () => {
    it.each([false, true])('keeps icon sizes when a guide highlight arrives (yield between notifications: %s)', async yieldBetween => {
        const { window, notify, rule } = await loadRuntime();
        window.document.body.insertAdjacentHTML('beforeend', '<svg class="w-3 h-3 text-slate-300"></svg>');
        const icons = notify();
        if (yieldBetween) await Promise.resolve();
        window.document.querySelector('svg')!.classList.add('first-use-highlight');
        const highlight = notify();
        await Promise.all([icons, highlight]);

        expect(rule('.w-3')?.style.width).toBe('0.75rem');
        expect(rule('.h-3')?.style.height).toBe('0.75rem');
        expect(rule('.text-slate-300')).toBeDefined();
        expect(rule('.w-4')?.style.width).toBe('1rem');
    });

    it.each([false, true])('keeps classes from rapid updates and earlier pages (yield between notifications: %s)', async yieldBetween => {
        const { window, notify, rule } = await loadRuntime();
        const builds: Promise<void>[] = [];
        window.document.body.innerHTML = '';
        for (const classes of ['w-3 h-3', 'w-5 h-5', 'w-7 h-7']) {
            window.document.body.insertAdjacentHTML('beforeend', `<svg class="${classes}"></svg>`);
            builds.push(notify());
            if (yieldBetween) await Promise.resolve();
        }
        await Promise.all(builds);
        expect(rule('.w-3')?.style.width).toBe('0.75rem');
        expect(rule('.w-5')?.style.width).toBe('1.25rem');
        expect(rule('.w-7')?.style.width).toBe('1.75rem');
        expect(rule('.w-4')?.style.width).toBe('1rem');
    });

    it('applies the latest theme reset while a previous build is pending', async () => {
        const { window, notify, rule } = await loadRuntime();
        window.document.body.innerHTML = '<svg class="w-3 h-3 text-brand"></svg>';
        const previous = notify();
        await Promise.resolve();
        (window as any).tailwind.config = { theme: { extend: { colors: { brand: '#123456' } } } };
        (window as any).tailwind.config.theme.extend.colors.brand = '#abcdef';
        await Promise.all([previous, notify()]);
        expect(rule('.w-3')?.style.width).toBe('0.75rem');
        expect(rule('.text-brand')?.style.color).toContain('171 205 239');
    });

    it('rebuilds custom Tailwind styles changed during compilation', async () => {
        const { window, notify, rule, stylesChanged } = await loadRuntime();
        window.document.body.innerHTML = '<svg class="w-3 h-3"></svg>';
        const icons = notify();
        await Promise.resolve();
        const custom = window.document.createElement('style');
        custom.type = 'text/tailwindcss';
        custom.textContent = '.custom-icon { @apply w-5; }';
        window.document.head.append(custom);
        const first = stylesChanged();
        custom.textContent = '.custom-icon { @apply w-7; }';
        await Promise.all([icons, first, stylesChanged()]);
        expect(rule('.custom-icon')?.style.width).toBe('1.75rem');
        expect(rule('.w-3')?.style.width).toBe('0.75rem');
    });

    it('recovers classes marked as seen by a failed compilation', async () => {
        const { window, notify, rule, stylesChanged } = await loadRuntime();
        window.document.body.innerHTML = '<svg class="w-3 h-3"></svg>';
        const custom = window.document.createElement('style');
        custom.type = 'text/tailwindcss';
        custom.textContent = '.custom-icon { @apply nonexistent-utility; }';
        window.document.head.append(custom);
        await expect(stylesChanged()).rejects.toThrow('nonexistent-utility');
        custom.remove();
        await notify();
        expect(rule('.w-3')?.style.width).toBe('0.75rem');
        expect(rule('.h-3')?.style.height).toBe('0.75rem');
    });
});
