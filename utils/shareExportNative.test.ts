import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ write: vi.fn(), append: vi.fn(), rename: vi.fn(), uri: vi.fn(), share: vi.fn(), remove: vi.fn(), savePhoto: vi.fn(), getAlbumsPath: vi.fn(), createAlbum: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true }, CapacitorHttp: {} }));
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: { writeFile: mocks.write, appendFile: mocks.append, rename: mocks.rename, getUri: mocks.uri, deleteFile: mocks.remove },
    Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' }, Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@capacitor-community/media', () => ({
    Media: { savePhoto: mocks.savePhoto, getAlbumsPath: mocks.getAlbumsPath, createAlbum: mocks.createAlbum },
}));
import { savePhotoToGallery, shareOrDownloadBlob } from './shareExport';
import { saveMemoryPalaceExport } from './memoryPalace/saveExport';

beforeEach(() => {
    vi.resetAllMocks();
    mocks.uri.mockResolvedValue({ uri: 'file:///cache/分享.png' });
    mocks.share.mockResolvedValue({});
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('FileReader', class {
        result = ''; onloadend?: () => void;
        readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(data => { this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`; this.onloadend?.(); }); }
    });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('native binary share files', () => {
    it('记忆 JSON 与全部备份一样写分享缓存并直接拉起系统面板', async () => {
        expect(await saveMemoryPalaceExport('{"记忆":"你好"}', 'memory.json', '记忆宫殿')).toEqual({ kind: 'shared' });
        const write = mocks.write.mock.calls[0][0];
        expect(write.directory).toBe('CACHE');
        expect(Buffer.from(write.data, 'base64').toString('utf8')).toBe('{"记忆":"你好"}');
        expect(mocks.share).toHaveBeenCalledTimes(1);
    });
    it('shares a cached PNG as binary instead of writing UTF-8 text', async () => {
        const bytes = Uint8Array.from([137, 80, 78, 71, 0, 255]);
        expect(await shareOrDownloadBlob({ blob: new Blob([bytes], { type: 'image/png' }), fileName: '分享.png' })).toBe('shared');
        const write = mocks.write.mock.calls[0][0];
        expect(write.encoding).toBeUndefined();
        expect(Buffer.from(write.data, 'base64')).toEqual(Buffer.from(bytes));
        expect(mocks.share).toHaveBeenCalledWith({ title: '分享.png', files: ['file:///cache/分享.png'] });
    });
    it.each(['Share canceled', 'Share cancelled'])('treats %s as cancellation without a second share/download', async message => {
        const webShare = vi.fn(); vi.stubGlobal('navigator', { share: webShare });
        mocks.share.mockRejectedValue(new Error(message));
        expect(await shareOrDownloadBlob({ blob: new Blob(['png']), fileName: '分享.png' })).toBe('cancelled');
        expect(webShare).not.toHaveBeenCalled();
        expect(mocks.share).toHaveBeenCalledTimes(1);
    });
    it('keeps large PNG payload bytes intact across native chunked writes', async () => {
        const bytes = new Uint8Array(3 * 1024 * 1024 + 11); bytes.fill(197); bytes[bytes.length - 1] = 255;
        expect(await shareOrDownloadBlob({ blob: new Blob([bytes]), fileName: 'large.png', nativeChunked: true })).toBe('shared');
        const parts = [mocks.write.mock.calls[0][0].data, ...mocks.append.mock.calls.map(call => call[0].data)];
        expect(Buffer.concat(parts.map(part => Buffer.from(part, 'base64'))).equals(Buffer.from(bytes))).toBe(true);
        expect(mocks.rename.mock.calls[0][0].to).toBe('large.png');
    });
    it('reports native failures instead of claiming a WebView downloaded the file', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.write.mockRejectedValue(new Error('disk full'));
        await expect(shareOrDownloadBlob({ blob: new Blob(['png']), fileName: '分享.png' })).rejects.toThrow('disk full');
        expect(mocks.share).not.toHaveBeenCalled();
    });
});

describe('native photo save', () => {
    const ALBUMS_PATH = '/storage/emulated/0/Android/media/com.example.sullyos/files';
    beforeEach(() => {
        mocks.getAlbumsPath.mockResolvedValue({ path: ALBUMS_PATH });
        mocks.createAlbum.mockResolvedValue(undefined);
    });
    it('保存照片写进系统相册的 SullyOS 相册，不再拉系统分享面板', async () => {
        const bytes = Uint8Array.from([137, 80, 78, 71, 0, 255]);
        expect(await savePhotoToGallery({ blob: new Blob([bytes], { type: 'image/png' }), fileName: '家园合影.png' })).toBe('gallery');
        expect(mocks.createAlbum).toHaveBeenCalledWith({ name: 'SullyOS' });
        expect(mocks.savePhoto).toHaveBeenCalledTimes(1);
        const call = mocks.savePhoto.mock.calls[0][0];
        expect(call.albumIdentifier).toBe(`${ALBUMS_PATH}/SullyOS`);
        // Android 的 fileName 不含扩展名，扩展名由插件从源文件补。
        expect(call.fileName).toMatch(/^家园合影_\d{14}$/);
        expect(call.path).toMatch(/^data:image\/png;base64,/);
        expect(Buffer.from(call.path.slice(call.path.indexOf(',') + 1), 'base64')).toEqual(Buffer.from(bytes));
        expect(mocks.share).not.toHaveBeenCalled();
        expect(mocks.write).not.toHaveBeenCalled();
    });
    it('相册已存在时 createAlbum 的 already exists 不算失败，照片照常入库', async () => {
        mocks.createAlbum.mockRejectedValue(new Error('Album already exists'));
        expect(await savePhotoToGallery({ blob: new Blob(['png'], { type: 'image/png' }), fileName: '家园合影.png' })).toBe('gallery');
        expect(mocks.savePhoto).toHaveBeenCalledTimes(1);
        expect(mocks.write).not.toHaveBeenCalled();
    });
    it('相册插件不可用时降级写公共文档目录，文件名带时间戳', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.getAlbumsPath.mockRejectedValue(new Error('not implemented'));
        expect(await savePhotoToGallery({ blob: new Blob(['png'], { type: 'image/png' }), fileName: '家园合影.png' })).toBe('documents');
        const write = mocks.write.mock.calls[0][0];
        expect(write.directory).toBe('DOCUMENTS');
        expect(write.path).toMatch(/^SullyOS\/家园合影_\d{14}\.png$/);
        expect(write.recursive).toBe(true);
        expect(mocks.share).not.toHaveBeenCalled();
    });
});
