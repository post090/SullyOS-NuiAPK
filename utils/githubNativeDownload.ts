import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { BackupDownloadSink } from './backupDownload';
import { BackupSpaceError, verifyBackupPart } from './backupDownload';

export interface CachedGithubAsset {
    size: number;
    writeTo(sink: BackupDownloadSink): Promise<void>;
    dispose(): Promise<void>;
}

export class NativeGithubDownloadError extends Error {
    constructor(message: string, readonly retryable: boolean) { super(message); }
}

let cleanup: Promise<void> | undefined;
const cacheName = /^sully-gh-backup-[0-9a-f-]{36}\.tmp$/;

/** Android's Filesystem plugin streams HTTPS to app-private disk and reports received bytes.
 * Only the local file is read through the WebView. The GitHub token stays on the native request. */
export async function downloadAndroidGithubAsset(
    assetUrl: string,
    headers: Record<string, string>,
    expected: { label: string; size?: number; digest?: string },
    onProgress?: (bytes: number) => void,
): Promise<CachedGithubAsset> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const directory = Directory.Cache;
    // A killed process cannot run finally. Only reclaim this downloader's old files.
    cleanup ??= Filesystem.readdir({ path: '.', directory }).then(async ({ files }) => {
        const staleBefore = Date.now() - 24 * 60 * 60 * 1000;
        const stale = files.filter(f => f.type === 'file' && cacheName.test(f.name) && f.mtime < staleBefore);
        await Promise.allSettled(stale.map(f => Filesystem.deleteFile({ directory, path: f.name })));
    }).catch(() => undefined);
    await cleanup;

    const id = crypto.randomUUID();
    const path = `sully-gh-backup-${id}.tmp`;
    // The plugin identifies progress events by URL. Concurrent downloads of one asset must stay separate.
    const url = `${assetUrl}?download=${id}`;
    const dispose = () => Filesystem.deleteFile({ directory, path }).catch(() => undefined);
    let listener: PluginListenerHandle | undefined;
    try {
        if (onProgress) {
            listener = await Filesystem.addListener('progress', event => {
                if (event.url === url && event.bytes > 0) onProgress(event.bytes);
            });
        }
        try {
            await Filesystem.downloadFile({
                url, headers, directory, path, progress: Boolean(listener),
                connectTimeout: 30_000, readTimeout: 60_000,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/ENOSPC|no space left/i.test(message)) throw new BackupSpaceError();
            const status = /(?:HTTP\s+|response code:\s*)([45]\d\d)\b/i.exec(message)?.[1];
            if (status) {
                throw new NativeGithubDownloadError(`下载 GitHub 备份附件失败（HTTP ${status}）。`,
                    status === '408' || status === '429' || Number(status) >= 500);
            }
            const cause = /timed?\s*out|timeout|超时/i.test(message) ? '连接或读取超时' : '连接中断';
            throw new NativeGithubDownloadError(`下载 GitHub 备份附件时${cause}，请检查当前网络后重试。`, true);
        }
        const { uri, size } = await Filesystem.stat({ directory, path });
        if (size === 0) throw new NativeGithubDownloadError(`${expected.label}是空文件。`, true);
        if (expected.size !== undefined && size !== expected.size) {
            throw new NativeGithubDownloadError(`${expected.label}大小不符（应为 ${expected.size} 字节，实际 ${size} 字节）。`, true);
        }
        const localUrl = Capacitor.convertFileSrc(uri);
        const openStream = async () => {
            const response = await fetch(localUrl, { cache: 'no-store' });
            if (!response.ok || !response.body) throw new Error('无法读取已下载的备份临时文件。');
            return response.body;
        };
        if (expected.digest) {
            try {
                await verifyBackupPart(await openStream(), expected);
            } catch (error) {
                throw new NativeGithubDownloadError(error instanceof Error ? error.message : '备份附件校验失败。', true);
            }
        }
        return {
            size, dispose,
            async writeTo(sink) {
                let copied = 0;
                await (await openStream()).pipeTo(new WritableStream({
                    async write(bytes) {
                        await sink.write(bytes);
                        copied += bytes.byteLength;
                    },
                }));
                if (copied !== size) throw new Error(`${expected.label}从缓存读出的大小不符（应为 ${size} 字节，实际 ${copied} 字节）。`);
            },
        };
    } catch (error) {
        await dispose();
        throw error;
    } finally {
        await listener?.remove().catch(() => undefined);
    }
}
