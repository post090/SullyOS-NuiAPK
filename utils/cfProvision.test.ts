/**
 * 一键部署里那几个「错了会静默出事」的地方。
 *
 * 都是踩过或者一眼能看出会踩的坑：密钥漏一条 worker 直接 503、compat flag 少一个
 * 角色调工具就 1042、重装换掉 Master Key 之前排的任务全解不开。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    parseWranglerConfig,
    buildBindings,
    deriveWorkerUrl,
    explainCfError,
    validateSubdomain,
    generateAmsgSecrets,
    scriptNameFromWorkerUrl,
    verifyToken,
    isAccountScopedToken,
    uploadWorkerScript,
    ensureSubdomain,
    checkRelayAvailable,
    explainRelayFailure,
    type AmsgSecrets,
} from './cfProvision';

const FULL_SECRETS: AmsgSecrets = {
    AMSG_MASTER_KEY: 'a'.repeat(64),
    VAPID_PUBLIC_KEY: 'pub-key',
    VAPID_PRIVATE_KEY: 'priv-key',
    VAPID_EMAIL: 'mailto:someone@example.com',
    AMSG_SERVER_TOKEN: 'server-token',
};

describe('parseWranglerConfig', () => {
    it('认得仓库里那份真的 wrangler.toml，不走兜底', () => {
        const toml = readFileSync(resolve(__dirname, '../worker/amsg/wrangler.toml'), 'utf8');
        const config = parseWranglerConfig(toml);

        // 少了这个 flag，角色到点调自配 MCP 会被当成内网调用拒掉（1042）
        expect(config.compatibilityFlags).toContain('global_fetch_strictly_public');
        // cron 是主动消息唯一的触发方式
        expect(config.crons).toEqual(['* * * * *']);
        expect(config.d1Binding).toBe('DB');
        expect(config.compatibilityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('注释不会被当成配置读进来', () => {
        const config = parseWranglerConfig(
            [
                '# compatibility_date = "1999-01-01"',
                'compatibility_date = "2026-01-01"  # 真正生效的是这行',
            ].join('\n'),
        );
        expect(config.compatibilityDate).toBe('2026-01-01');
    });

    it('读不出来的项各自回落到兜底值，不返回半份配置', () => {
        const config = parseWranglerConfig('name = "whatever"');

        expect(config.compatibilityFlags).toContain('global_fetch_strictly_public');
        expect(config.crons).toEqual(['* * * * *']);
        expect(config.d1Binding).toBe('DB');
    });

    it('顶层的 binding 键不会被误当成 D1 的 binding', () => {
        const config = parseWranglerConfig(
            ['binding = "NOT_THE_D1_ONE"', '', '[[d1_databases]]', 'binding = "REAL_DB"'].join('\n'),
        );
        expect(config.d1Binding).toBe('REAL_DB');
    });
});

describe('buildBindings', () => {
    it('D1 用 CF 要的 {type,name,id} 形状', () => {
        const bindings = buildBindings('DB', 'db-uuid-1234', FULL_SECRETS);
        expect(bindings[0]).toEqual({ type: 'd1', name: 'DB', id: 'db-uuid-1234' });
    });

    /**
     * 回归守卫：新部署必须自带即时对话的起跳器。
     *
     * 漏了它，装出来的 Worker 一发即时对话就 503（instantChat 认的就是这个 binding），
     * 而用户刚走完一键部署，界面上一切正常，只会以为是功能坏了。
     */
    it('自带 INSTANT_TICK 的 Durable Object binding', () => {
        const bindings = buildBindings('DB', 'x', FULL_SECRETS);
        expect(bindings).toContainEqual({
            type: 'durable_object_namespace',
            name: 'INSTANT_TICK',
            class_name: 'InstantTickDO',
        });
    });

    it('五个密钥一条不落——漏一条上去 worker 就起不来', () => {
        const bindings = buildBindings('DB', 'x', FULL_SECRETS);
        const names = bindings.filter((b) => b.type === 'secret_text').map((b) => b.name);

        expect(names).toEqual(
            expect.arrayContaining([
                'AMSG_MASTER_KEY',
                'VAPID_PUBLIC_KEY',
                'VAPID_PRIVATE_KEY',
                'VAPID_EMAIL',
                'AMSG_SERVER_TOKEN',
            ]),
        );
    });

    it('空密钥不写进去：塞空串等于开了一道永远对不上的门', () => {
        const bindings = buildBindings('DB', 'x', {
            ...FULL_SECRETS,
            AMSG_SERVER_TOKEN: '',
            VAPID_EMAIL: '   ',
        });
        const names = bindings.map((b) => b.name);

        expect(names).not.toContain('AMSG_SERVER_TOKEN');
        expect(names).not.toContain('VAPID_EMAIL');
        expect(names).toContain('AMSG_MASTER_KEY');
    });

    it('额外的项（自更新要的 CF token）也走 secret，不是明文', () => {
        const bindings = buildBindings('DB', 'x', FULL_SECRETS, {
            CF_API_TOKEN: 'cf-token',
            CF_SCRIPT_NAME: 'sullyos-amsg',
        });
        const cfToken = bindings.find((b) => b.name === 'CF_API_TOKEN');

        expect(cfToken?.type).toBe('secret_text');
        expect(cfToken?.text).toBe('cf-token');
    });
});

describe('generateAmsgSecrets', () => {
    it('传了已有的 Master Key 就原样保留——换掉会让之前排的任务全解不开', async () => {
        const existing = 'b'.repeat(64);
        const secrets = await generateAmsgSecrets({ AMSG_MASTER_KEY: existing });

        expect(secrets.AMSG_MASTER_KEY).toBe(existing);
    });

    it('传了已有的 VAPID 就原样保留——换掉之前的推送订阅会全部 403', async () => {
        const secrets = await generateAmsgSecrets({
            VAPID_PUBLIC_KEY: 'old-pub',
            VAPID_PRIVATE_KEY: 'old-priv',
        });

        expect(secrets.VAPID_PUBLIC_KEY).toBe('old-pub');
        expect(secrets.VAPID_PRIVATE_KEY).toBe('old-priv');
    });

    it('什么都不传就全新生成，Master Key 是 64 位 hex', async () => {
        const secrets = await generateAmsgSecrets();

        expect(secrets.AMSG_MASTER_KEY).toMatch(/^[0-9a-f]{64}$/);
        expect(secrets.VAPID_PUBLIC_KEY.length).toBeGreaterThan(80);
        expect(secrets.AMSG_SERVER_TOKEN).toBeTruthy();
    });

    it('两次生成不会撞', async () => {
        const a = await generateAmsgSecrets();
        const b = await generateAmsgSecrets();

        expect(a.AMSG_MASTER_KEY).not.toBe(b.AMSG_MASTER_KEY);
        expect(a.VAPID_PUBLIC_KEY).not.toBe(b.VAPID_PUBLIC_KEY);
    });
});

describe('verifyToken', () => {
    /** 装一个假的中转，返回它收到的请求路径。 */
    const stubRelay = (payload: unknown, status = 200) => {
        const paths: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const relayed = new URL(String(url)).searchParams.get('path');
            if (relayed) paths.push(relayed);
            return new Response(JSON.stringify(payload), {
                status,
                headers: { 'Content-Type': 'application/json' },
            });
        }));
        return paths;
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('还没到生效日期的 token 要拦下来——CF 这时照样回 success:true', async () => {
        // 放过去的话，后面每一步都收到通用的 Authentication error，会被归成
        // 「权限不够」，用户跑去改权限，可那根本不是原因。真机上踩过一次。
        stubRelay({
            success: true,
            result: { id: 'x', status: 'active', not_before: '2026-08-10T00:00:00Z' },
            messages: [{ code: 10002, message: 'This API Token can not be used before 2026-08-10' }],
        });

        const result = await verifyToken('plain-token');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('TOKEN_NOT_YET_VALID');
            expect(result.message).toContain('2026-08-10');
        }
    });

    it('正常的 token 放行', async () => {
        stubRelay({ success: true, result: { id: 'x', status: 'active' }, messages: [] });

        expect((await verifyToken('plain-token')).ok).toBe(true);
    });

    it('账号令牌当场说清楚该换哪种，而不是拿用户级端点去撞 401', async () => {
        // cfat_ 打 /user/tokens/verify 必然 1000，报错原文只会说 Invalid API Token，
        // 用户对着那句话查不出「你建错了种类」。
        const paths = stubRelay({ success: true });

        const result = await verifyToken('cfat_abcdef');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('TOKEN_INVALID');
            expect(result.message).toContain('API Tokens');
        }
        // 一次网络都不该发
        expect(paths).toHaveLength(0);
    });

    it('普通 token 走用户级端点', async () => {
        const paths = stubRelay({ success: true, result: { status: 'active' }, messages: [] });

        await verifyToken('plain-token');

        expect(paths).toEqual(['/user/tokens/verify']);
    });

    it('认得出账号令牌的前缀', () => {
        expect(isAccountScopedToken('cfat_abc')).toBe(true);
        expect(isAccountScopedToken('  cfat_abc  ')).toBe(true);
        expect(isAccountScopedToken('abcdef123')).toBe(false);
    });
});

describe('uploadWorkerScript', () => {
    /**
     * 装一个假的中转，按次序吐响应，并把每次上传的 metadata 记下来。
     */
    const stubUploadRelay = (responses: Array<{ status: number; payload: unknown }>) => {
        const metadatas: Array<Record<string, unknown>> = [];
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
            const form = init?.body as FormData;
            const metaBlob = form.get('metadata') as Blob;
            metadatas.push(JSON.parse(await metaBlob.text()));
            const next = responses[Math.min(metadatas.length - 1, responses.length - 1)];
            return new Response(JSON.stringify(next.payload), {
                status: next.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }));
        return metadatas;
    };

    const FRESH_METADATA = {
        main_module: 'worker.bundle.js',
        bindings: [{ type: 'durable_object_namespace', name: 'INSTANT_TICK', class_name: 'InstantTickDO' }],
        migrations: { new_tag: 'amsg-instant-tick-v1', new_sqlite_classes: ['InstantTickDO'] },
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    /**
     * 回归守卫：对着已经装过的 Worker 重装（清了地址重跑、换设备再部署）。
     *
     * metadata 里的 migrations 断言「全新部署」，这时 CF 会回 10079 乐观锁冲突把整次
     * 上传顶回来——修法是去掉 migrations 重传（namespace 本来就在），binding 原样保留。
     */
    it('撞上 10079 就去掉 migrations 重传一次，并标记这是覆盖更新', async () => {
        const metadatas = stubUploadRelay([
            {
                status: 400,
                payload: {
                    success: false,
                    errors: [{ code: 10079, message: "Actor migration tag precondition failed, got tag '' when expected tag is 'amsg-instant-tick-v1'." }],
                },
            },
            { status: 200, payload: { success: true, result: {} } },
        ]);

        const result = await uploadWorkerScript('tok', 'acct', 'sullyos-amsg', FRESH_METADATA, 'export default {}');

        expect(result.ok).toBe(true);
        expect(result.reusedExistingWorker).toBe(true);
        expect(metadatas).toHaveLength(2);
        expect(metadatas[1].migrations).toBeUndefined();
        // 只该去掉 migrations，binding 等其余字段原样保留
        expect(metadatas[1].bindings).toEqual(metadatas[0].bindings);
        expect(metadatas[1].main_module).toBe(metadatas[0].main_module);
    });

    it('全新部署一次成功就不重试，也不标记覆盖更新', async () => {
        const metadatas = stubUploadRelay([{ status: 200, payload: { success: true, result: {} } }]);

        const result = await uploadWorkerScript('tok', 'acct', 'sullyos-amsg', FRESH_METADATA, 'export default {}');

        expect(result.ok).toBe(true);
        expect(result.reusedExistingWorker).toBeUndefined();
        expect(metadatas).toHaveLength(1);
    });

    it('其他错误不套这个重试——盲目去掉 migrations 只会把真错误拖成两次', async () => {
        const metadatas = stubUploadRelay([
            {
                status: 400,
                payload: { success: false, errors: [{ code: 10037, message: 'workers limit reached' }] },
            },
        ]);

        const result = await uploadWorkerScript('tok', 'acct', 'sullyos-amsg', FRESH_METADATA, 'export default {}');

        expect(result.ok).toBe(false);
        expect(metadatas).toHaveLength(1);
    });
});

describe('checkRelayAvailable', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('200 且 relay 认得上 → 可用', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(
            JSON.stringify({ relay: 'cf-api' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        )));

        expect(await checkRelayAvailable()).toEqual({ ok: true });
    });

    /**
     * 回归守卫：三种失败要分得开，尤其这条——网络不通（DNS 解析失败、超时、被墙）跟
     * Worker 版本新旧没关系。以前一律说「缺 /cf-api，把代理地址改回默认的」，用默认
     * 地址、只是断网的人被指使着反复折腾一个本来就没问题的设置。
     */
    it('fetch 直接抛（网络不通）→ reason 是 network', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

        expect(await checkRelayAvailable()).toEqual({ ok: false, reason: 'network' });
    });

    it('404 → reason 是 http-status，状态码带回去给排查用', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })));

        expect(await checkRelayAvailable()).toEqual({ ok: false, reason: 'http-status', status: 404 });
    });

    it('200 但 relay 字段对不上 → bad-response（指的不是 SullyOS 的代理）', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(
            JSON.stringify({ hello: 'world' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        )));

        expect(await checkRelayAvailable()).toEqual({ ok: false, reason: 'bad-response' });
    });

    it('200 但压根不是 JSON → 也算响应内容不对，不当网络错误报', async () => {
        // 浏览器的 fetch 只有网络层失败才抛；能收到 200 的 HTML 说明路是通的，
        // 说「连不上」会把人指去查一个没问题的网络。
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>不是代理 Worker</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        })));

        expect(await checkRelayAvailable()).toEqual({ ok: false, reason: 'bad-response' });
    });
});

describe('explainRelayFailure', () => {
    // 三种失败 × 默认/自定义代理，指路方向不能串：网络不通的查网络、版本旧的更新
    // Worker、指错地址的改地址。钉住每条话里的关键词，串了立刻能看出来。

    it('网络不通 + 默认代理：指去查网络或配自定义地址，不赖 Worker 版本', () => {
        const msg = explainRelayFailure('network', false, '一键部署');

        expect(msg).toContain('无法连接到默认代理 Worker');
        expect(msg).toContain('一键部署');
        expect(msg).toContain('设置 → 网络代理');
        expect(msg).not.toContain('版本过旧');
    });

    it('网络不通 + 自定义代理：指去检查自己的地址，而不是叫人改回默认', () => {
        const msg = explainRelayFailure('network', true, '一键部署');

        expect(msg).toContain('无法连接到你配置的自定义代理 Worker');
        expect(msg).toContain('检查网络连接和代理地址');
    });

    it('HTTP 非 2xx + 默认代理：说的是版本过旧、缺 /cf-api', () => {
        const msg = explainRelayFailure('http-status', false, '这个操作');

        expect(msg).toContain('这个操作');
        expect(msg).toContain('版本过旧');
        expect(msg).toContain('/cf-api');
    });

    it('HTTP 非 2xx + 自定义代理：指去更新自己的 Worker，或临时改回默认', () => {
        const msg = explainRelayFailure('http-status', true, '这个操作');

        expect(msg).toContain('版本过旧');
        expect(msg).toContain('更新你的 Worker');
        expect(msg).toContain('改回默认代理地址');
    });

    it('响应内容不对：说是指向了错误的地址，三种失败里只有这条提这个', () => {
        const msg = explainRelayFailure('bad-response', false, '一键部署');

        expect(msg).toContain('响应异常');
        expect(msg).toContain('指向了错误的地址');
        expect(msg).toContain('SullyOS 代理');
    });
});

describe('explainCfError', () => {
    it('权限不够时把要勾的三项列出来，而不是干说 Unauthorized', () => {
        const msg = explainCfError(403, { errors: [{ code: 9109, message: 'Unauthorized' }] });

        expect(msg).toContain('Workers Scripts:Edit');
        expect(msg).toContain('D1:Edit');
        expect(msg).toContain('Account Settings:Read');
    });

    it('token 格式错（多带了空格换行）单独提示', () => {
        const msg = explainCfError(400, { errors: [{ code: 6111, message: 'Invalid format' }] });
        expect(msg).toContain('空格');
    });

    it('认不出来的错至少把 CF 的原话带上', () => {
        const msg = explainCfError(500, { errors: [{ code: 12345, message: 'Something odd' }] });
        expect(msg).toContain('Something odd');
    });

    // 下面三条钉住「翻译之外一定留原文」。翻译是兜底猜的，猜错时用户得有东西可查——
    // 尤其 401/403 那条：不留原文的话，中转层和 WAF 的 403 都长得跟「token 缺权限」
    // 一模一样，人会被指使着反复去改一枚本来就没问题的 token。
    it('权限提示后面带着 CF 原文、code 和 HTTP 状态', () => {
        const msg = explainCfError(403, { errors: [{ code: 9109, message: 'Unauthorized' }] });

        expect(msg).toContain('Unauthorized');
        expect(msg).toContain('9109');
        expect(msg).toContain('403');
    });

    it('中转层自己回的 403 也要露出原话，别看着像 token 缺权限', () => {
        // 中转的错误体是 { error }，不是 CF 的 errors 数组，得单独捞。
        const msg = explainCfError(403, {
            error: 'This proxy only relays account-scoped Cloudflare API paths',
        });

        expect(msg).toContain('This proxy only relays');
    });

    it('响应根本不是 JSON 时，至少把 HTTP 状态说出来', () => {
        const msg = explainCfError(403, null);

        expect(msg).toContain('403');
    });

    it('带上出事的那个请求，认得出卡在哪一步', () => {
        const msg = explainCfError(403, null, 'POST /accounts/acc-1/d1/database');

        expect(msg).toContain('POST /accounts/acc-1/d1/database');
    });
});

describe('ensureSubdomain', () => {
    /** 按路径派响应的假中转，返回它收到的「方法 + 路径」清单。 */
    const stubRelay = (
        handler: (path: string, method: string) => { payload: unknown; status?: number },
    ) => {
        const seen: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
            const path = new URL(String(url)).searchParams.get('path') || '';
            const headers = (init?.headers || {}) as Record<string, string>;
            const method = headers['X-CF-Method'] || 'GET';
            seen.push(`${method} ${path}`);
            const { payload, status = 200 } = handler(path, method);
            return new Response(JSON.stringify(payload), {
                status,
                headers: { 'Content-Type': 'application/json' },
            });
        }));
        return seen;
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('账号已经有子域名就直接用', async () => {
        stubRelay(() => ({ payload: { success: true, result: { subdomain: 'kaede' } } }));

        expect(await ensureSubdomain('tok', 'acc-1')).toEqual({ ok: true, subdomain: 'kaede' });
    });

    it('读子域名被 403 时说权限，而不是请用户再起一个名字', async () => {
        // 读都读不动，注册那一步同样过不去。当成新账号劝人换名字，用户会一直换下去。
        const seen = stubRelay(() => ({
            payload: { success: false, errors: [{ code: 9109, message: 'Unauthorized' }] },
            status: 403,
        }));

        const result = await ensureSubdomain('tok', 'acc-1', 'kaede');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('CF_ERROR');
            expect(result.error).toContain('Unauthorized');
        }
        // 注定失败的注册请求也不该发
        expect(seen).toEqual(['GET /accounts/acc-1/workers/subdomain']);
    });

    it('403 之外的读失败照旧当新账号处理，别把还没建过子域名的人堵死', async () => {
        const seen = stubRelay((_path, method) => (method === 'GET'
            ? { payload: { success: false, errors: [{ code: 10007, message: 'not found' }] }, status: 404 }
            : { payload: { success: true, result: {} } }));

        const result = await ensureSubdomain('tok', 'acc-1', 'kaede');

        expect(result).toEqual({ ok: true, subdomain: 'kaede' });
        expect(seen).toContain('PUT /accounts/acc-1/workers/subdomain');
    });
});

describe('scriptNameFromWorkerUrl', () => {
    it('workers.dev 地址认得出脚本名', () => {
        expect(scriptNameFromWorkerUrl('https://sullyos-amsg.kaede.workers.dev')).toBe('sullyos-amsg');
        expect(scriptNameFromWorkerUrl('https://sullyos-amsg.kaede.workers.dev/')).toBe('sullyos-amsg');
    });

    it('自定义域名和代理门面一律返回 null，不猜', () => {
        // 猜出来的名字会指向账号里另一个 Worker，把钥匙写到别人身上去。
        expect(scriptNameFromWorkerUrl('https://amsg.example.com')).toBeNull();
        expect(scriptNameFromWorkerUrl('https://my-proxy.deno.dev')).toBeNull();
        // 少一段：这是账号子域本身，不是某个脚本
        expect(scriptNameFromWorkerUrl('https://kaede.workers.dev')).toBeNull();
    });

    it('填的不是地址时返回 null 而不是抛错', () => {
        expect(scriptNameFromWorkerUrl('随便写的')).toBeNull();
        expect(scriptNameFromWorkerUrl('')).toBeNull();
    });
});

describe('deriveWorkerUrl / validateSubdomain', () => {
    it('地址是「脚本名.子域.workers.dev」', () => {
        expect(deriveWorkerUrl('sullyos-amsg', 'kaede')).toBe('https://sullyos-amsg.kaede.workers.dev');
    });

    it('合法子域放行', () => {
        expect(validateSubdomain('kaede-123')).toBeNull();
    });

    it('连字符开头结尾、太短、带大写和非法字符都要挡下', () => {
        expect(validateSubdomain('-nope')).not.toBeNull();
        expect(validateSubdomain('nope-')).not.toBeNull();
        expect(validateSubdomain('ab')).not.toBeNull();
        expect(validateSubdomain('has_underscore')).not.toBeNull();
        expect(validateSubdomain('')).not.toBeNull();
    });
});
