import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error Worker entry is plain runtime JavaScript.
import worker from './index.js';

const expand = (url: string) => worker.fetch(new Request('https://local.test/expand-url', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url }),
}), {}, { waitUntil() {} });

describe('/expand-url', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('拿到手机笔记地址即返回，不再请求可能跳验证码的正文页', async () => {
    const noteUrl = 'https://www.xiaohongshu.com/discovery/item/6aa4aaf6000000000b00eab5?xsec_token=test%3D&xsec_source=app_share';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: noteUrl } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await expand('https://xhslink.cn/o/2KuQOsv8aMN');
    expect(await res.json()).toEqual({ success: true, data: { finalUrl: noteUrl } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('普通短链仍支持多跳和相对 Location', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/final' } }))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await (await expand('https://example.com/short')).json()).toEqual({ success: true, data: { finalUrl: 'https://example.com/final' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('跳转内网时拒绝继续请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await expand('https://xhslink.cn/o/test')).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('上游错误和循环跳转不伪装成展开成功', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await expand('https://xhslink.cn/o/test')).status).toBe(502);
    fetchMock.mockClear().mockImplementation(async () => new Response(null, { status: 302, headers: { location: '/loop' } }));
    expect((await expand('https://example.com/loop')).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
