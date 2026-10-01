/**
 * 即时对话回复落库后的 SAR 收尾（走真库，fake-indexeddb 由 test-setup 注入）。
 *
 * 钉住的是「云端那一轮成功落定后，本地该发生的三件事都发生了、且只按请求时的快照发生」：
 * USER_SURFACE 写回用户消息、事件快照写到本轮用户消息、角色 / 用户模块各推进一回合。
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile, SARModuleRuntimeState, UserProfile } from '../types';
import { DB } from './db';
import {
    readAmsgSarSnapshot,
    readAmsgSarSurface,
    resolveAmsgSarSnapshot,
    resolveAmsgSarSurface,
    settleSarModuleAfterCloudReply,
    stripAmsgSarTransportKeys,
} from './sarModuleCloudSettle';
import { SAR_MODULE_RUNTIME_CHANGED_EVENT } from './sarModuleRuntimeEvents';
import {
    createSARModuleEventMeta,
    installSARModuleOnCharacter,
    installSARModuleOnUser,
    toSARModuleSurfaceSource,
    type AmsgSarModuleSnapshot,
} from './vrWorld/sarModuleRuntime';
import { SAR_MODULE_CATALOG } from './vrWorld/sarModuleShop';

const sarModule = SAR_MODULE_CATALOG[0];
let seq = 0;

/** 每条用例用自己的角色，避免真库里互相串。 */
const setup = async (opts: { user?: boolean; character?: boolean } = { user: true, character: true }) => {
    seq += 1;
    const charId = `char-sar-settle-${seq}`;
    const now = Date.now();
    const charModule = opts.character === false ? undefined : installSARModuleOnCharacter(sarModule, now - 1000);
    const char = {
        id: charId,
        name: '凯',
        vrState: { enabled: true, intervalMinutes: 120, ...(charModule ? { sarModule: charModule } : {}) },
    } as CharacterProfile;
    await DB.saveCharacter(char);
    const userModule = opts.user === false ? undefined : installSARModuleOnUser(sarModule, char, now - 1000);
    const user = {
        name: '小明', avatar: '', bio: '',
        vrState: { enabled: true, currentRoom: 'lobby', ...(userModule ? { sarModule: userModule } : {}) },
    } as unknown as UserProfile;
    await DB.saveUserProfile(user);
    const userMsgA = await DB.saveMessage({ charId, role: 'user', type: 'text', content: '今天好累' } as any);
    const userMsgB = await DB.saveMessage({ charId, role: 'user', type: 'text', content: '想吃火锅' } as any);
    const snapshot: AmsgSarModuleSnapshot = {
        v: 1,
        character: charModule ? toSARModuleSurfaceSource(charModule) : undefined,
        user: userModule ? toSARModuleSurfaceSource(userModule) : undefined,
        events: createSARModuleEventMeta({
            character: charModule, user: userModule,
            hasActiveEffect: true, hasAfterglow: false, requiresEnvelope: true,
        }),
        userMessageId: userMsgB,
        userSurfaceTargetIds: [userMsgA, userMsgB],
        reroll: false,
    };
    return { charId, charModule, userModule, userMsgA, userMsgB, snapshot };
};

const userSurfaceRaw = (a: number, b: number) => JSON.stringify([
    { id: a, surface: '今天元气满满' },
    { id: b, surface: '想吃沙拉' },
]);

const readCharModule = async (charId: string): Promise<SARModuleRuntimeState | undefined> =>
    (await DB.getAllCharacters()).find(c => c.id === charId)?.vrState?.sarModule;
const readUserModule = async () => (await DB.getUserProfile())?.vrState?.sarModule;

describe('settleSarModuleAfterCloudReply（走真库）', () => {
    let dispatched: Array<{ type: string; detail: any }>;

    beforeAll(() => {
        (globalThis as any).window ??= { dispatchEvent: () => true, addEventListener: () => {} };
    });
    beforeEach(() => {
        dispatched = [];
        vi.spyOn((globalThis as any).window, 'dispatchEvent').mockImplementation((event: any) => {
            dispatched.push({ type: event.type, detail: event.detail });
            return true;
        });
    });
    afterEach(() => { vi.restoreAllMocks(); });

    it('USER_SURFACE 按 id 写到目标用户消息，外显 meta 指向用户那份模块', async () => {
        const ctx = await setup();
        const result = await settleSarModuleAfterCloudReply({
            charId: ctx.charId, snapshot: ctx.snapshot, userSurfaceRaw: userSurfaceRaw(ctx.userMsgA, ctx.userMsgB),
        });
        expect(result.userSurfaceIds.sort()).toEqual([ctx.userMsgA, ctx.userMsgB].sort());
        const a = await DB.getMessageById(ctx.userMsgA);
        const b = await DB.getMessageById(ctx.userMsgB);
        expect(a?.metadata?.sarModuleSurface).toMatchObject({
            version: 1, target: 'user', phase: 'active', runId: ctx.userModule!.runId, surface: '今天元气满满',
        });
        expect(b?.metadata?.sarModuleSurface?.surface).toBe('想吃沙拉');
        // content 始终是真实语义，外显只进 metadata。
        expect(a?.content).toBe('今天好累');
    });

    it('目标消息丢了就跳过那一条，其余照写', async () => {
        const ctx = await setup();
        await DB.deleteMessage(ctx.userMsgA);
        const result = await settleSarModuleAfterCloudReply({
            charId: ctx.charId, snapshot: ctx.snapshot, userSurfaceRaw: userSurfaceRaw(ctx.userMsgA, ctx.userMsgB),
        });
        expect(result.userSurfaceIds).toEqual([ctx.userMsgB]);
        expect(await DB.getMessageById(ctx.userMsgA)).toBeNull();
        expect((await DB.getMessageById(ctx.userMsgB))?.metadata?.sarModuleSurface?.surface).toBe('想吃沙拉');
    });

    it('事件快照写到 userMessageId 那条消息', async () => {
        const ctx = await setup();
        await settleSarModuleAfterCloudReply({ charId: ctx.charId, snapshot: ctx.snapshot });
        const b = await DB.getMessageById(ctx.userMsgB);
        expect(b?.metadata?.sarModuleEvents).toEqual(ctx.snapshot.events);
        expect(ctx.snapshot.events.length).toBe(2);
        expect((await DB.getMessageById(ctx.userMsgA))?.metadata?.sarModuleEvents).toBeUndefined();
    });

    it('角色 / 用户各推进一回合，写进 DB，vrState 其它字段不动', async () => {
        const ctx = await setup();
        const result = await settleSarModuleAfterCloudReply({ charId: ctx.charId, snapshot: ctx.snapshot });
        expect(result.advanced).toEqual({ character: true, user: true });
        expect((await readCharModule(ctx.charId))?.remainingTurns).toBe(ctx.charModule!.remainingTurns - 1);
        expect((await readUserModule())?.remainingTurns).toBe(ctx.userModule!.remainingTurns - 1);
        const char = (await DB.getAllCharacters()).find(c => c.id === ctx.charId)!;
        expect(char.vrState?.intervalMinutes).toBe(120);
        expect((await DB.getUserProfile())?.vrState?.currentRoom).toBe('lobby');
    });

    it('最后一回合走完 → 模块从 vrState 上删掉，而不是留个 undefined 值', async () => {
        const ctx = await setup({ character: true, user: false });
        const last: SARModuleRuntimeState = { ...ctx.charModule!, phase: 'afterglow', remainingTurns: 0, afterglowTurns: 1 };
        const char = (await DB.getAllCharacters()).find(c => c.id === ctx.charId)!;
        await DB.saveCharacter({ ...char, vrState: { ...char.vrState!, sarModule: last } });
        const result = await settleSarModuleAfterCloudReply({
            charId: ctx.charId,
            snapshot: { ...ctx.snapshot, character: toSARModuleSurfaceSource(last) },
        });
        expect(result.advanced.character).toBe(true);
        const after = (await DB.getAllCharacters()).find(c => c.id === ctx.charId)!;
        expect('sarModule' in (after.vrState || {})).toBe(false);
        expect(after.vrState?.enabled).toBe(true);
    });

    it('重掷：外显和事件照写，但回合不推进', async () => {
        const ctx = await setup();
        const result = await settleSarModuleAfterCloudReply({
            charId: ctx.charId,
            snapshot: { ...ctx.snapshot, reroll: true },
            userSurfaceRaw: userSurfaceRaw(ctx.userMsgA, ctx.userMsgB),
        });
        expect(result.advanced).toEqual({ character: false, user: false });
        expect(result.userSurfaceIds.length).toBe(2);
        expect(result.eventsWritten).toBe(true);
        expect((await readCharModule(ctx.charId))?.remainingTurns).toBe(ctx.charModule!.remainingTurns);
        expect((await readUserModule())?.remainingTurns).toBe(ctx.userModule!.remainingTurns);
    });

    it('请求发出后用户换了模块（runId 对不上）→ 不推进新模块', async () => {
        const ctx = await setup();
        const replacement = installSARModuleOnCharacter(SAR_MODULE_CATALOG[1] ?? sarModule, Date.now());
        const char = (await DB.getAllCharacters()).find(c => c.id === ctx.charId)!;
        await DB.saveCharacter({ ...char, vrState: { ...char.vrState!, sarModule: replacement } });
        expect(replacement.runId).not.toBe(ctx.charModule!.runId);

        const result = await settleSarModuleAfterCloudReply({ charId: ctx.charId, snapshot: ctx.snapshot });
        expect(result.advanced.character).toBe(false);
        expect(await readCharModule(ctx.charId)).toEqual(replacement);
    });

    it('用户那份模块不在 active（余韵期）→ 不写用户外显', async () => {
        const ctx = await setup();
        const snapshot: AmsgSarModuleSnapshot = {
            ...ctx.snapshot,
            user: { ...ctx.snapshot.user!, phase: 'afterglow' },
        };
        const result = await settleSarModuleAfterCloudReply({
            charId: ctx.charId, snapshot, userSurfaceRaw: userSurfaceRaw(ctx.userMsgA, ctx.userMsgB),
        });
        expect(result.userSurfaceIds).toEqual([]);
        expect((await DB.getMessageById(ctx.userMsgA))?.metadata?.sarModuleSurface).toBeUndefined();
    });

    it('每次调用都按快照里有的那几侧派发回灌事件（没推进也派，让内存对齐 DB）', async () => {
        const ctx = await setup();
        await settleSarModuleAfterCloudReply({ charId: ctx.charId, snapshot: ctx.snapshot });
        const sarEvents = () => dispatched.filter(e => e.type === SAR_MODULE_RUNTIME_CHANGED_EVENT);
        expect(sarEvents().map(e => e.detail)).toEqual([
            { target: 'character', charId: ctx.charId },
            { target: 'user', charId: ctx.charId },
        ]);

        dispatched = [];
        // 第二次：runId 仍对得上，所以会再推一格——这是调用方要防的（挂在销账块里只进一次）。
        // 这里只钉事件照派。
        await settleSarModuleAfterCloudReply({ charId: ctx.charId, snapshot: { ...ctx.snapshot, reroll: false } });
        expect(sarEvents().length).toBe(2);
    });
});

describe('push metadata 上的 SAR 回程字段', () => {
    it('readAmsgSarSurface 只认 v1 + active + 非空外显', () => {
        const ok = { version: 1, phase: 'active', surface: '嗯', runId: 'r', target: 'character' };
        expect(readAmsgSarSurface({ amsgSarSurface: ok })).toEqual(ok);
        expect(readAmsgSarSurface({ amsgSarSurface: { ...ok, version: 2 } })).toBeUndefined();
        expect(readAmsgSarSurface({ amsgSarSurface: { ...ok, phase: 'afterglow' } })).toBeUndefined();
        expect(readAmsgSarSurface({ amsgSarSurface: { ...ok, surface: '  ' } })).toBeUndefined();
        expect(readAmsgSarSurface({ amsgSarSurface: 'x' })).toBeUndefined();
        expect(readAmsgSarSurface(undefined)).toBeUndefined();
    });

    it('readAmsgSarSnapshot 只认 v===1，缺的列表按空处理', () => {
        expect(readAmsgSarSnapshot({ amsgSar: { v: 2 } })).toBeUndefined();
        expect(readAmsgSarSnapshot({ amsgSar: { v: 1 } })).toEqual({
            v: 1, character: undefined, user: undefined, events: [], userMessageId: undefined,
            userSurfaceTargetIds: [], reroll: false,
        });
    });

    it('stripAmsgSarTransportKeys 剔掉六个载具键（含两根旁路引用）、不动入参', () => {
        const meta = {
            a: 1, amsgSar: {}, amsgSarRef: 'sar_snapshot:t', amsgSarSurface: {}, amsgSarSurfaceRef: 'sar_surface:t:1',
            amsgSarUserSurface: 'x', amsgSarUserSurfaceRef: 'k',
        };
        expect(stripAmsgSarTransportKeys(meta)).toEqual({ a: 1 });
        expect(meta.amsgSar).toBeDefined();
    });
});

describe('SAR 回程内容挪进旁路存储后按引用键取回', () => {
    const surfaceMeta = { version: 1, phase: 'active', surface: '嗯哼', runId: 'r', target: 'character' };
    const snapshot = {
        v: 1, character: { runId: 'r', moduleId: 'm', moduleTitle: 't', target: 'character', phase: 'active' },
        events: [], userSurfaceTargetIds: [3], reroll: false,
    };
    beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('外显：内联的优先，不去取旁路', async () => {
        const fetcher = vi.fn(async () => JSON.stringify({ ...surfaceMeta, surface: '旁路那份' }));
        const got = await resolveAmsgSarSurface({ amsgSarSurface: surfaceMeta, amsgSarSurfaceRef: 'sar_surface:t:1' }, fetcher);
        expect(got?.surface).toBe('嗯哼');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('外显：只有引用键 → 取回、解析、过同一道校验', async () => {
        const got = await resolveAmsgSarSurface(
            { amsgSarSurfaceRef: 'sar_surface:t:1' },
            async () => JSON.stringify(surfaceMeta),
        );
        expect(got).toEqual(surfaceMeta);
    });

    it('外显：取不回 / 不是 JSON / 形状不对 → undefined（不抛，这一段显示真实回复）', async () => {
        const meta = { amsgSarSurfaceRef: 'sar_surface:t:1' };
        expect(await resolveAmsgSarSurface(meta, async () => null)).toBeUndefined();
        expect(await resolveAmsgSarSurface(meta, async () => '{坏掉的')).toBeUndefined();
        expect(await resolveAmsgSarSurface(meta, async () => JSON.stringify({ ...surfaceMeta, phase: 'afterglow' }))).toBeUndefined();
    });

    it('外显：两个都没有 → 不去取', async () => {
        const fetcher = vi.fn(async () => null);
        expect(await resolveAmsgSarSurface({ a: 1 }, fetcher)).toBeUndefined();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('快照：只有引用键 → 取回并规整成和内联同样的形状', async () => {
        const got = await resolveAmsgSarSnapshot({ amsgSarRef: 'sar_snapshot:t' }, async () => JSON.stringify(snapshot));
        expect(got).toEqual(readAmsgSarSnapshot({ amsgSar: snapshot }));
        expect(got?.userSurfaceTargetIds).toEqual([3]);
    });

    it('快照：内联的优先；取不回 / 版本不对 → undefined（整轮不收尾）', async () => {
        const fetcher = vi.fn(async () => JSON.stringify({ ...snapshot, reroll: true }));
        expect((await resolveAmsgSarSnapshot({ amsgSar: snapshot, amsgSarRef: 'sar_snapshot:t' }, fetcher))?.reroll).toBe(false);
        expect(fetcher).not.toHaveBeenCalled();
        const meta = { amsgSarRef: 'sar_snapshot:t' };
        expect(await resolveAmsgSarSnapshot(meta, async () => null)).toBeUndefined();
        expect(await resolveAmsgSarSnapshot(meta, async () => JSON.stringify({ ...snapshot, v: 2 }))).toBeUndefined();
        expect(await resolveAmsgSarSnapshot(meta, async () => 'nope')).toBeUndefined();
    });
});
