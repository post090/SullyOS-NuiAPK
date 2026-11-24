// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Gallery from '../apps/Gallery';
import { AppID, type GalleryImage } from '../types';
import { appShortcutLaunch } from './appShortcutLaunch';
import * as favorites from './contentFavorites';
import { DB } from './db';

const os = vi.hoisted(() => ({
    characters: [{ id: 'a', name: '角色甲', avatar: '/a.png' }, { id: 'b', name: '角色乙', avatar: '/b.png' }],
    apiConfig: { apiKey: 'fixture', model: 'vision', baseUrl: 'https://example.invalid' },
    addToast: vi.fn(), closeApp: vi.fn(),
    registerBackHandler: vi.fn< (handler: () => boolean) => () => void >(() => vi.fn()),
}));
vi.mock('../context/OSContext', () => ({ useOS: () => os }));

const photo = (id: string, charId: string, timestamp = 1): GalleryImage => ({ id, charId, timestamp, url: `/photos/${id}.png` });
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

let host: HTMLDivElement, root: Root;
beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
async function renderGallery() {
    vi.spyOn(DB, 'getGalleryImageCounts').mockResolvedValue({ a: 1, b: 2 });
    await act(async () => root.render(React.createElement(Gallery)));
}
async function openCharacter(name: string) {
    const button = host.querySelector(`img[alt="${name}"]`)?.closest('button');
    if (!button) throw new Error(`找不到相册 ${name}`);
    await act(async () => button.click());
}
async function back() {
    const handler = os.registerBackHandler.mock.lastCall?.[0];
    await act(async () => { expect(handler?.()).toBe(true); });
}
const gridPhotos = () => Array.from(host.querySelectorAll('img[src^="/photos/"]'), img => img.getAttribute('src'));

it.each(['相册列表', '快捷入口'])('从%s切换相册后，旧的读取不能覆盖新角色的照片', async path => {
    const a = deferred<GalleryImage[]>(), b = deferred<GalleryImage[]>();
    const load = vi.spyOn(DB, 'getGalleryImages').mockImplementation(id => id === 'a' ? a.promise : b.promise);
    await renderGallery();
    expect(load).not.toHaveBeenCalled();
    await openCharacter('角色甲');
    if (path === '相册列表') {
        await back();
        await openCharacter('角色乙');
    } else {
        await act(async () => appShortcutLaunch.request({ appId: AppID.Gallery, characterId: 'b' }));
    }
    expect(host.querySelector('h1')?.textContent).toBe('角色乙');
    expect(host.textContent).toContain('正在读取照片');
    await act(async () => b.resolve([photo('b1', 'b'), photo('b2', 'b', 2)]));
    await act(async () => a.resolve([photo('a1', 'a')]));
    expect(gridPhotos()).toEqual(['/photos/b2.png', '/photos/b1.png']);
    expect(load.mock.calls).toEqual([['a'], ['b']]);
});

it('换相册时立即移走旧缩略图，读取失败后可从列表重新打开', async () => {
    const b = deferred<GalleryImage[]>();
    vi.spyOn(DB, 'getGalleryImages').mockResolvedValueOnce([photo('a', 'a')])
        .mockReturnValueOnce(b.promise.then(() => { throw new Error('unavailable'); }))
        .mockResolvedValueOnce([]);
    await renderGallery();
    await openCharacter('角色甲');
    expect(gridPhotos()).toEqual(['/photos/a.png']);
    await back();
    await openCharacter('角色乙');
    expect(gridPhotos()).toEqual([]);
    await act(async () => b.resolve([]));
    expect(host.textContent).toContain('照片读取失败');
    await back();
    await openCharacter('角色乙');
    expect(host.textContent).toContain('还没有照片');
});

it('旧照片的点评与收藏读取完成后，当前照片和它的收藏状态不变', async () => {
    const first = photo('first', 'a'), second = photo('second', 'a', 2);
    const saved = await favorites.saveGalleryImageContentFavorite(first, '角色甲');
    const oldFavorite = deferred<Awaited<ReturnType<typeof favorites.getContentFavoriteById>>>();
    vi.spyOn(favorites, 'getContentFavoriteById').mockReturnValueOnce(oldFavorite.promise).mockResolvedValue(null);
    vi.spyOn(DB, 'getGalleryImages').mockResolvedValue([first, second]);
    const update = vi.spyOn(DB, 'updateGalleryImageReview').mockResolvedValue(undefined);
    const response = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => response.promise));
    try {
        await renderGallery();
        await openCharacter('角色甲');
        await act(async () => host.querySelector<HTMLImageElement>(`img[src="${first.url}"]`)!.click());
        const review = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('让 TA 点评照片'))!;
        await act(async () => review.click());
        expect(fetch).toHaveBeenCalledOnce();
        await back();
        await act(async () => host.querySelector<HTMLImageElement>(`img[src="${second.url}"]`)!.click());
        await act(async () => oldFavorite.resolve(saved));
        await act(async () => response.resolve(new Response(JSON.stringify({ choices: [{ message: { content: '第一张的点评' } }] }))));
        expect(update).toHaveBeenCalledWith(first.id, '第一张的点评');
        expect(host.querySelector('img[alt="Detail"]')?.getAttribute('src')).toBe(second.url);
        expect(host.querySelector('button[aria-label="收藏图片"]')).not.toBeNull();
        expect(host.textContent).not.toContain('第一张的点评');
        await back();
        await act(async () => host.querySelector<HTMLImageElement>(`img[src="${first.url}"]`)!.click());
        expect(host.querySelector('[aria-label="照片点评"]')?.textContent).toContain('第一张的点评');
    } finally {
        await act(async () => { await favorites.removeContentFavoriteById(saved.id); });
    }
});

it('从角色索引统计真实照片和空相册，无需读取照片内容', async () => {
    const a = photo('count-a', 'count-owner'), b = photo('count-b', 'count-owner');
    const other = photo('count-other', 'unrelated-owner');
    try {
        for (const image of [a, b, other]) await DB.saveGalleryImage(image);
        const readImages = vi.spyOn(IDBIndex.prototype, 'getAll');
        expect(await DB.getGalleryImageCounts([a.charId, 'empty-owner'])).toEqual({ 'count-owner': 2, 'empty-owner': 0 });
        expect(readImages).not.toHaveBeenCalled();
        expect(await DB.getGalleryImageCounts([])).toEqual({});
    } finally {
        for (const image of [a, b, other]) await DB.deleteGalleryImage(image.id);
    }
});
