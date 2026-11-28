import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupArchive } from './backupArchive';
import { openLegacyBackup } from './backupFormat';
import { openBackupZip } from './backupZipReader';
import { downloadBackup, listBackups } from './githubClient';

const bridge = vi.hoisted(() => ({
    request: vi.fn(), downloadFile: vi.fn(), stat: vi.fn(), readdir: vi.fn(),
    addListener: vi.fn(), deleteFile: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => true, getPlatform: () => 'android',
        convertFileSrc: () => 'https://localhost/_capacitor_file_/backup.tmp',
    },
    CapacitorHttp: { request: bridge.request },
}));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: bridge }));

const config = {
    enabled: true, provider: 'github' as const, webdavUrl: '', username: '', password: '',
    remotePath: '/', githubOwner: 'example', githubRepo: 'backups', githubToken: 'test-token', githubUseProxy: false,
};
const assetUrl = 'https://api.github.com/repos/example/backups/releases/assets/41';
const tempUri = 'file:///private/cache/backup.tmp';
const removeListener = vi.fn<() => Promise<void>>();
let emitProgress: (event: { url: string; bytes: number; contentLength: number }) => void;

beforeEach(() => {
    vi.resetAllMocks();
    removeListener.mockResolvedValue(undefined);
    bridge.addListener.mockImplementation(async (_name, listener) => {
        emitProgress = listener;
        return { remove: removeListener };
    });
    bridge.readdir.mockResolvedValue({ files: [] });
    bridge.deleteFile.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); });

function listSingleZip(bytes: Uint8Array<ArrayBuffer>, digest = createHash('sha256').update(bytes).digest('hex')) {
    const name = 'Sully_Backup_full_fixture';
    bridge.request.mockImplementation(async ({ url, responseType }) => {
        if (responseType === 'arraybuffer') throw new Error('The ZIP must not cross the native bridge as base64');
        if (!url.includes('/releases?')) throw new Error('Unexpected metadata request');
        return { status: 200, headers: {}, data: [{
            id: 40, tag_name: 'sully-backup-v2-fixture', draft: false,
            assets: [
                { id: 41, name: name + '.zip', state: 'uploaded', size: bytes.length, digest: 'sha256:' + digest },
                { id: 42, name: name + '.sully-backup.json', state: 'uploaded', size: 300 },
            ],
        }] };
    });
    bridge.stat.mockResolvedValue({ size: bytes.length, uri: tempUri });
    const readLocal = vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe('https://localhost/_capacitor_file_/backup.tmp');
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
        const middle = Math.floor(bytes.length / 2);
        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(bytes.slice(0, middle));
                controller.enqueue(bytes.slice(middle));
                controller.close();
            },
        }));
    });
    vi.stubGlobal('fetch', readLocal);
    return listBackups(config).then(([file]) => file);
}

describe('Android 直连 GitHub 恢复', () => {
    it('单个完整 ZIP 下载途中按实际字节更新，校验后仍能沿正常入口读回', async () => {
        const archive = createBackupArchive();
        archive.file('data.json', JSON.stringify({ messages: [{ id: 'test-message' }] }));
        const bytes = new Uint8Array(await (await archive.generateBlob()).arrayBuffer());
        const file = await listSingleZip(bytes);
        const progress: number[] = [];
        bridge.downloadFile.mockImplementation(async options => {
            expect(new URL(options.url).origin + new URL(options.url).pathname).toBe(assetUrl);
            expect(options).toMatchObject({
                directory: 'CACHE', progress: true,
                headers: { Authorization: 'Bearer test-token', Accept: 'application/octet-stream' },
            });
            emitProgress({ url: assetUrl + '?unrelated', bytes: bytes.length, contentLength: bytes.length });
            expect(progress).toEqual([0]);
            emitProgress({ url: options.url, bytes: Math.floor(bytes.length / 2), contentLength: 0 });
            expect(progress.at(-1)).toBeGreaterThan(30);
            expect(progress.at(-1)).toBeLessThan(70);
            return { path: tempUri };
        });
        const backup = await downloadBackup(config, file, value => progress.push(value));
        const zip = await openBackupZip(backup!.blob);
        try {
            expect((await openLegacyBackup(zip)).messages).toEqual([{ id: 'test-message' }]);
        } finally {
            await zip.close();
            await backup!.dispose();
        }
        expect(progress.at(-1)).toBe(100);
        expect(removeListener).toHaveBeenCalledOnce();
        expect(bridge.deleteFile).toHaveBeenCalledOnce();
    });

    it('下载同样长度的错误内容要重试并拒绝恢复，每次都清理临时文件', async () => {
        const file = await listSingleZip(new Uint8Array([4, 5, 6]), '0'.repeat(64));
        bridge.downloadFile.mockResolvedValue({ path: tempUri });
        const progress = vi.fn();
        await expect(downloadBackup(config, file, progress)).rejects.toThrow('校验和不符');
        expect(bridge.downloadFile).toHaveBeenCalledTimes(3);
        expect(bridge.deleteFile).toHaveBeenCalledTimes(3);
        expect(progress).not.toHaveBeenCalledWith(100);
    });

    it('多附件断线后只重试当前附件，按顺序拼回原始字节', async () => {
        const ids: string[] = [];
        const first = new Uint8Array([1, 2]);
        const second = new Uint8Array([3, 4, 5]);
        let current = first;
        let interrupted = false;
        bridge.downloadFile.mockImplementation(async options => {
            const id = new URL(options.url).pathname.split('/').at(-1)!;
            ids.push(id);
            current = id === '41' ? first : second;
            emitProgress({ url: options.url, bytes: 1, contentLength: current.length });
            if (id === '42' && !interrupted) {
                interrupted = true;
                throw new Error('Read timed out');
            }
            return { path: tempUri };
        });
        bridge.stat.mockImplementation(async () => ({ uri: tempUri, size: current.length }));
        vi.stubGlobal('fetch', vi.fn(async () => new Response(current)));
        const progress: number[] = [];
        const backup = await downloadBackup(config, {
            name: 'split.zip', href: '40:41,42', size: 5, lastModified: '',
            partSizes: [2, 3], partDigests: [first, second].map(b => 'sha256:' + createHash('sha256').update(b).digest('hex')),
        }, pct => progress.push(pct));
        expect(Array.from(new Uint8Array(await backup!.blob.arrayBuffer()))).toEqual([1, 2, 3, 4, 5]);
        await backup!.dispose();
        expect(ids).toEqual(['41', '42', '42']);
        expect(progress).toEqual([...new Set(progress)].sort((a, b) => a - b));
        expect(bridge.deleteFile).toHaveBeenCalledTimes(3);
    });

    it('没有仓库权限时结束下载，保留 HTTP 状态并清理监听与缓存', async () => {
        const file = await listSingleZip(new Uint8Array([1, 2, 3]));
        bridge.downloadFile.mockRejectedValue(new Error('Server returned HTTP response code: 403 for URL: https://example.invalid/private'));
        const progress = vi.fn();
        await expect(downloadBackup(config, file, progress)).rejects.toThrow('HTTP 403');
        expect(bridge.downloadFile).toHaveBeenCalledOnce();
        expect(removeListener).toHaveBeenCalledOnce();
        expect(bridge.deleteFile).toHaveBeenCalledOnce();
        expect(fetch).not.toHaveBeenCalled();
        expect(progress).not.toHaveBeenCalledWith(100);
    });

    it('没有摘要的旧附件也要核对实际从缓存读出的字节数', async () => {
        bridge.downloadFile.mockResolvedValue({ path: tempUri });
        bridge.stat.mockResolvedValue({ size: 6, uri: tempUri });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
        const progress = vi.fn();
        await expect(downloadBackup(config, {
            name: 'legacy.zip', href: '40:41', size: 6, lastModified: '',
        }, progress)).rejects.toThrow('从缓存读出的大小不符');
        expect(bridge.deleteFile).toHaveBeenCalledOnce();
        expect(progress).not.toHaveBeenCalledWith(100);
    });
});
