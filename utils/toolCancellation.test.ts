import { afterEach, expect, it, vi } from 'vitest';
import { performSearch } from './realtimeFetchCore';
import { XhsMcpClient } from './xhsMcpClient';

afterEach(() => vi.unstubAllGlobals());
it('停止后不会发起搜索或小红书评论', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(performSearch('查询', 'key', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(XhsMcpClient.comment('https://xhs.test', 'note', '评论', undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
});
