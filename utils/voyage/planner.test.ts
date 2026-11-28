import { afterEach, expect, it, vi } from 'vitest';
import { makeConnection, plannerRequestId, readPlan, readPlannerStatus, reviewPlan, submitBrief } from './planner';
import { trackVoyageResult } from './analytics';
import { trackEvent } from '../analytics';

vi.mock('../analytics', () => ({ trackEvent: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const c = makeConnection('https://planner.example.org/mcp', 'a'.repeat(43));
const signal = () => new AbortController().signal;
const id = 'trip-example';
const content = { destination:'测试城市', outline:'半日散步', weather:'冬季，临近再核对', alternatives:'下雨可选室内', sources:['https://example.org/guide'] };
const draft = { version:2, digest:'b'.repeat(64), content };
const row = { id, brief:'半日散步', state:'draft', draft, approvedDraft:null };

it('sends only the confirmed brief and an opaque ID; repeat submissions address the same request', async () => {
    const opaque = await plannerRequestId({id:'local-letter',charId:'private-char'});
    expect(opaque).toMatch(/^[0-9a-f]{64}$/);
    expect(await plannerRequestId({id:'local-letter',charId:'private-char'})).toBe(opaque);
    const send = vi.fn(async (_url: string, _init: RequestInit) => Response.json({...row,id:opaque}));
    vi.stubGlobal('fetch',send);
    await submitBrief(c,opaque,' 半日散步 ',signal());
    const [url, init] = send.mock.calls[0];
    expect(url).toBe(c.origin+'/device/requests/'+opaque);
    expect(init).toMatchObject({method:'POST',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
    expect(JSON.parse(init.body as string)).toEqual({brief:'半日散步'});
    expect(url).not.toContain('private-char');
    expect(() => makeConnection('https://user:pass@planner.example.org/',c.token)).toThrow();
    expect(() => makeConnection('http://planner.example.org/',c.token)).toThrow();
});
it('distinguishes missing, failed and approved requests and refuses mismatched or unsafe content', async () => {
    const send = vi.fn().mockResolvedValueOnce(new Response(null,{status:404}))
        .mockResolvedValueOnce(new Response(null,{status:401}))
        .mockResolvedValueOnce(Response.json({...row,id:'wrong'}))
        .mockResolvedValueOnce(Response.json({...row,state:'approved'}))
        .mockResolvedValueOnce(Response.json({...row,draft:{...draft,content:{...content,sources:['javascript:void(0)']}}}))
        .mockResolvedValueOnce(Response.json({...row,state:'approved',approvedDraft:draft}));
    vi.stubGlobal('fetch',send);
    expect(await readPlan(c,id,signal())).toBeNull();
    await expect(readPlannerStatus(c,signal())).rejects.toThrow(/配对码/);
    await expect(readPlan(c,id,signal())).rejects.toThrow(/不匹配/);
    await expect(readPlan(c,id,signal())).rejects.toThrow(/审批版本/);
    await expect(readPlan(c,id,signal())).rejects.toThrow(/格式无效/);
    expect((await reviewPlan(c,id,draft,'approve','',signal())).approvedDraft).toEqual(draft);
    const [url,init] = send.mock.lastCall!;
    expect(url).toBe(c.origin+'/device/requests/'+id+'/review');
    expect(JSON.parse(init.body)).toEqual({decision:'approve',version:2,digest:draft.digest});
});
it('guards empty briefs, preserves the observed version on conflicts and requires feedback for a return', async () => {
    const send=vi.fn().mockResolvedValue(new Response(null,{status:409}));
    vi.stubGlobal('fetch',send);
    await expect(submitBrief(c,id,'  ',signal())).rejects.toThrow(/旅行想法/);
    await expect(reviewPlan(c,id,draft,'return','',signal())).rejects.toThrow(/修改意见/);
    expect(send).not.toHaveBeenCalled();
    await expect(reviewPlan(c,id,draft,'return','补充雨天路线',signal())).rejects.toThrow(/刷新/);
    expect(send).toHaveBeenCalledTimes(1);
});
it('rejects oversized notes before sending and reports a service that dropped the selected reference', async () => {
    const oldServer = vi.fn().mockResolvedValue(Response.json(row));
    vi.stubGlobal('fetch', oldServer);
    await expect(submitBrief(c, id, '散步', signal(), '记'.repeat(90000))).rejects.toThrow(/256 KiB/);
    expect(oldServer).not.toHaveBeenCalled();
    await expect(submitBrief(c, id, '散步', signal(), '附加叮嘱', true)).rejects.toThrow(/刷新核对/);
    expect(oldServer).toHaveBeenCalledTimes(1);
});
it('allows only fixed action labels in voyage analytics', () => {
    for (const value of [id, content, 'private-url', c.token, '慢悠悠']) {
        trackVoyageResult(value, true); trackVoyageResult(value, false);
    }
    trackVoyageResult('refresh',true);
    expect(trackEvent).not.toHaveBeenCalled();
    trackVoyageResult('return',true); trackVoyageResult('reply',false);
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['审核旅行草稿',{decision:'return'}],['旅行邀请未完成',{step:'reply'}]]);
});
