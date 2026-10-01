/**
 * GitHub 备份 · 原生（Android/iOS WebView）上传路径测试。
 *
 * 背景：原生端附件上传曾直接用 WebView fetch() 打 uploads.github.com（跨域
 * POST 必过 CORS 预检，且该线路在部分网络不可达），fetch 抛的
 * TypeError("Failed to fetch") 被原样透传 —— APK 用户看到的「云端备份失败:
 * 上传失败: Failed to fetch」就是它。修复后原生直连统一走 CapacitorHttp
 * （base64 + dataType:'file'，原生层解码回原始字节），只有开启应用内中转
 * 时才继续用 WebView fetch → Worker。
 *
 * 这里必须整文件 mock @capacitor/core（isNativePlatform 恒真），所以与
 * web 行为的测试（githubClient.test.ts）分开存放。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capacitorHttpMocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true },
    CapacitorHttp: { request: capacitorHttpMocks.request },
}));
import { uploadBackup } from './githubClient';

// 测试环境是 node（无 DOM）：githubClient 的 blobToBase64 用 FileReader 把 Blob
// 转 base64，这里按同样语义 stub（与 shareExportNative.test.ts 的做法一致）。
// afterEach 会 unstubAllGlobals，所以放在 beforeEach 里每条用例前重新装上。
class FileReaderStub {
    result = '';
    onload?: () => void;
    onerror?: () => void;
    readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then(data => {
            this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`;
            this.onload?.();
        }, () => this.onerror?.());
    }
}

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

type NativeRequest = { url: string; method: string; headers: Record<string, string>; data?: unknown; dataType?: string; readTimeout?: number; connectTimeout?: number };

const assetUploadCalls = (): NativeRequest[] =>
    capacitorHttpMocks.request.mock.calls
        .map(([options]) => options as NativeRequest)
        .filter(options => String(options.url).startsWith('https://uploads.github.com/'));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
});

beforeEach(() => {
    vi.stubGlobal('FileReader', FileReaderStub);
});

describe('GitHub 备份 · 原生直连上传', () => {
    it('附件经 CapacitorHttp 以 base64+dataType:"file" 上传，不再触碰 WebView fetch', async () => {
        const zipBytes = Uint8Array.from([80, 75, 3, 4, 0, 255, 1, 197]);
        const blob = new Blob([zipBytes], { type: 'application/zip' });

        capacitorHttpMocks.request.mockImplementation(async (options: NativeRequest) => {
            const url = String(options.url);
            if (url.endsWith('/releases') && options.method === 'POST') {
                return { status: 201, headers: {}, data: { id: 88 } };
            }
            if (url.startsWith('https://uploads.github.com/')) {
                const name = new URL(url).searchParams.get('name') || '';
                if (name.endsWith('.sully-backup.json')) {
                    // 完成标记按原始 JSON 字符串发送，原生层原样写 body。
                    expect(options.dataType).toBeUndefined();
                    expect(options.headers['Content-Type']).toBe('application/json');
                    const size = Buffer.byteLength(String(options.data), 'utf8');
                    return { status: 201, headers: {}, data: { id: 302, name, size, state: 'uploaded' } };
                }
                // 备份分片按官方约定转 base64 + dataType:'file'，原生层解码回原始字节。
                expect(options.headers['Content-Type']).toBe('application/zip');
                expect(options.dataType).toBe('file');
                const decoded = Buffer.from(String(options.data), 'base64');
                return { status: 201, headers: {}, data: { id: 301, name, size: decoded.length, state: 'uploaded' } };
            }
            if (url.endsWith('/releases/88') && options.method === 'PATCH') {
                return { status: 200, headers: {}, data: { id: 88, draft: false } };
            }
            throw new Error(`unexpected native request: ${options.method} ${url}`);
        });
        const webFetch = vi.fn(() => Promise.reject(new Error('原生直连不应使用 WebView fetch')));
        vi.stubGlobal('fetch', webFetch);

        const result = await uploadBackup(config, blob, 'Sully_Backup_full_1.zip');

        expect(result.ok).toBe(true);
        expect(webFetch).not.toHaveBeenCalled();

        const assetCalls = assetUploadCalls();
        expect(assetCalls).toHaveLength(2); // zip 分片 + 完成标记
        const [zipCall, manifestCall] = assetCalls;
        expect(Buffer.from(String(zipCall.data), 'base64')).toEqual(Buffer.from(zipBytes));
        expect(zipCall.readTimeout).toBe(15 * 60 * 1000);
        expect(zipCall.connectTimeout).toBe(15 * 60 * 1000);
        expect(String(zipCall.url)).toContain('name=Sully_Backup_full_1.zip');
        expect(String(manifestCall.url)).toContain('.sully-backup.json');
        expect(typeof manifestCall.data).toBe('string');
        expect(() => JSON.parse(String(manifestCall.data))).not.toThrow();
    }, 20_000);

    it('网络层失败时给分线路的描述性提示并清理草稿，不再裸透传 "Failed to fetch"', async () => {
        capacitorHttpMocks.request.mockImplementation(async (options: NativeRequest) => {
            const url = String(options.url);
            if (url.endsWith('/releases') && options.method === 'POST') {
                return { status: 201, headers: {}, data: { id: 77 } };
            }
            if (url.includes('/releases/77/assets') && options.method === 'GET') {
                return { status: 200, headers: {}, data: [] };
            }
            if (url.startsWith('https://uploads.github.com/')) {
                throw new TypeError('Failed to fetch');
            }
            if (options.method === 'DELETE') {
                return { status: 204, headers: {}, data: null };
            }
            throw new Error(`unexpected native request: ${options.method} ${url}`);
        });
        const webFetch = vi.fn(() => Promise.reject(new Error('原生直连不应使用 WebView fetch')));
        vi.stubGlobal('fetch', webFetch);

        const result = await uploadBackup(config, new Blob(['zip']), 'Sully_Backup_full_1.zip');

        expect(result.ok).toBe(false);
        expect(result.message).toContain('第 1/1 片失败');
        expect(result.message).toContain('上传失败：网络请求未完成');
        expect(result.message).toContain('uploads.github.com');
        expect(result.message).toContain('草稿已清理');
        // 可重试的网络错误会打满 MAX_ASSET_ATTEMPTS 次，全部走原生层。
        expect(assetUploadCalls()).toHaveLength(3);
        expect(webFetch).not.toHaveBeenCalled();
    }, 20_000);
});

describe('GitHub 备份 · 原生 + 应用内中转', () => {
    it('附件仍走 WebView fetch → Worker（流式 Blob），不经原生桥 base64', async () => {
        const proxyConfig = { ...config, githubUseProxy: true, githubProxyConsentVersion: 1 };
        capacitorHttpMocks.request.mockImplementation(async () => {
            throw new Error('开启中转时不应调用 CapacitorHttp');
        });

        const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
            const raw = String(input);
            if (!raw.startsWith('https://sullymeow.ccwu.cc/github?url=')) {
                throw new Error(`unexpected non-proxied fetch on native proxy mode: ${raw}`);
            }
            const target = new URL(decodeURIComponent(raw.split('?url=')[1]));
            const headers = (init?.headers || {}) as Record<string, string>;
            const ghMethod = headers['X-GitHub-Method'] || 'GET';
            if (target.pathname.endsWith('/releases') && ghMethod === 'POST') {
                return Promise.resolve(new Response(JSON.stringify({ id: 99 }), { status: 201 }));
            }
            if (target.hostname === 'uploads.github.com' && ghMethod === 'POST') {
                const name = target.searchParams.get('name') || '';
                const body = init?.body;
                const size = body instanceof Blob ? body.size : Buffer.byteLength(String(body ?? ''), 'utf8');
                return Promise.resolve(new Response(
                    JSON.stringify({ id: 400, name, size, state: 'uploaded' }),
                    { status: 201, headers: { 'Content-Type': 'application/json' } },
                ));
            }
            if (target.pathname.endsWith('/releases/99') && ghMethod === 'PATCH') {
                return Promise.resolve(new Response(JSON.stringify({ id: 99, draft: false }), { status: 200 }));
            }
            throw new Error(`unexpected proxied request: ${ghMethod} ${target.href}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const proxiedUploads = (): [string, RequestInit & { headers: Record<string, string> }][] =>
            (fetchMock.mock.calls as unknown as [string, RequestInit & { headers: Record<string, string> }][]).filter(([url]) => {
                const raw = String(url);
                if (!raw.startsWith('https://sullymeow.ccwu.cc/github?url=')) return false;
                return decodeURIComponent(raw.split('?url=')[1]).includes('uploads.github.com');
            });

        const result = await uploadBackup(proxyConfig, new Blob(['zip']), 'Sully_Backup_full_2.zip');

        expect(result.ok).toBe(true);
        const uploadCalls = proxiedUploads();
        expect(uploadCalls).toHaveLength(2); // zip 分片 + 完成标记
        const [zipCall, manifestCall] = uploadCalls;
        expect(zipCall[1]?.body).toBeInstanceOf(Blob);
        expect(zipCall[1]?.headers['X-GitHub-Method']).toBe('POST');
        expect(typeof manifestCall[1]?.body).toBe('string');
    }, 20_000);
});
