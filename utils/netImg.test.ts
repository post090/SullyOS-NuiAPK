// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import NetImg from '../components/os/NetImg';
import { dataUrlToBlob, putImageBlob } from './blobRef';

// 回归守卫：表情包外链（catbox 等）裂图后要走公共镜像。上次大合并把表情渲染换成了
// TokenImg（只解析令牌、不兜底），catbox 表情在没代理的网络里整排裂掉。NetImg 现在既
// 解析 blobref 令牌、又对外链做镜像兜底，表情相关调用点统一用它。

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
(URL as any).createObjectURL = vi.fn(() => 'blob:netimg-1');
(URL as any).revokeObjectURL = vi.fn();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const img = () => container.querySelector('img')!;
const fail = () => act(() => { img().dispatchEvent(new Event('error')); });

describe('NetImg 外链镜像兜底', () => {
    it('catbox 原链裂了依次切到 wsrv / weserv / Photon', () => {
        const url = 'https://files.catbox.moe/abc123.gif';
        act(() => root.render(createElement(NetImg, { src: url })));
        expect(img().getAttribute('src')).toBe(url);

        fail();
        expect(img().getAttribute('src')).toBe(`https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`);
        fail();
        expect(img().getAttribute('src')).toContain('images.weserv.nl');
        fail();
        expect(img().getAttribute('src')).toBe('https://i0.wp.com/files.catbox.moe/abc123.gif?ssl=1');
    });

    it('同一图床裂过之后，新的图直接从镜像起跳', () => {
        act(() => root.render(createElement(NetImg, { src: 'https://files.catbox.moe/second.png' })));
        expect(img().getAttribute('src')).toContain('wsrv.nl');
    });

    it('blobref 令牌照样解析成 objectURL，不走镜像', async () => {
        const token = await putImageBlob(dataUrlToBlob(PNG));
        await act(async () => { root.render(createElement(NetImg, { src: token })); });
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        expect(img().getAttribute('src')).toBe('blob:netimg-1');
    });
});
