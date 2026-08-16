import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBackup, readResponseArrayBuffer, shouldUseGithubProxy } from './githubClient';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('GitHub 备份代理安全默认', () => {
    const base = {
        enabled: true,
        webdavUrl: '',
        username: '',
        password: '',
        remotePath: '/',
    };

    it('新用户与缺少代理字段的旧配置默认直连', () => {
        expect(shouldUseGithubProxy(base)).toBe(false);
    });

    it('旧版默认写入的 true 没有新版确认标记时仍然直连', () => {
        expect(shouldUseGithubProxy({ ...base, githubUseProxy: true })).toBe(false);
    });

    it('只有用户在新版说明下明确开启后才走中转', () => {
        expect(shouldUseGithubProxy({
            ...base,
            githubUseProxy: true,
            githubProxyConsentVersion: 1,
        })).toBe(true);
    });

    it('明确关闭始终直连', () => {
        expect(shouldUseGithubProxy({
            ...base,
            githubUseProxy: false,
            githubProxyConsentVersion: 1,
        })).toBe(false);
    });
});

describe('readResponseArrayBuffer', () => {
    it('reports streamed byte progress while preserving the payload', async () => {
        const source = new Uint8Array([1, 2, 3, 4, 5, 6]);
        const progress: number[] = [];
        const result = await readResponseArrayBuffer(new Response(source), value => progress.push(value));

        expect(Array.from(new Uint8Array(result))).toEqual(Array.from(source));
        expect(progress.length).toBeGreaterThan(0);
        expect(progress.at(-1)).toBe(source.byteLength);
    });
});

describe('GitHub 备份下载错误', () => {
    const config = {
        enabled: true,
        provider: 'github' as const,
        webdavUrl: '',
        username: '',
        password: '',
        remotePath: '/',
        githubToken: 'github_pat_test',
        githubOwner: 'owner',
        githubRepo: 'sully-backup',
        githubUseProxy: false,
    };

    const file = {
        name: 'Sully_Backup_full_1.zip',
        href: '123:512999539',
        size: 1024,
        lastModified: new Date().toISOString(),
    };

    it('正式环境能够直连时仍直接下载，不会自动切到 Worker', async () => {
        const directFetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
        vi.stubGlobal('fetch', directFetch);

        const blob = await downloadBackup(config, file);

        expect(blob?.size).toBe(3);
        expect(String(directFetch.mock.calls[0][0])).toBe(
            'https://api.github.com/repos/owner/sully-backup/releases/assets/512999539',
        );
    });

    it('网页直连被 CORS/网络拦截时给出手动开启中转的提示', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        await expect(downloadBackup(config, file)).rejects.toThrow(
            '手动开启 Cloudflare 中转后重试；应用不会自动开启',
        );
    });

    it('GitHub 返回权限错误时保留 HTTP 状态和处理建议', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));

        await expect(downloadBackup(config, file)).rejects.toThrow('HTTP 403');
    });
});
