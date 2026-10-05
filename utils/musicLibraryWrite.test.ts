import { afterEach, describe, expect, it, vi } from 'vitest';
import { musicApi, type MusicCfg } from '../context/MusicContext';

const cfg = { cookie: 'MUSIC_U=test-cookie-123456', workerUrl: 'https://worker.example', quality: 'exhigh' } as unknown as MusicCfg;

const mockFetch = (responses: any[]) => {
  const bodies: any[] = [];
  const fn = vi.fn(async (_url: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    const next = responses.shift() ?? { code: 200 };
    return { ok: true, status: 200, json: async () => next } as any;
  });
  vi.stubGlobal('fetch', fn);
  return { fn, bodies };
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('netease library writes', () => {
  it('treats HTTP 200 with an error body code as a failure', async () => {
    mockFetch([{ code: 301, msg: '需要登录' }]);
    await expect(musicApi.like(cfg, 1, true)).rejects.toThrow('需要登录');
  });

  it('busts cached playlist reads after a successful like', async () => {
    const { bodies } = mockFetch([
      { songs: [] },          // 先读一次歌单 → 进客户端缓存
      { code: 200 },          // 喜欢
      { songs: [{ id: 1 }] }, // 再读：必须重新请求，并带写入时间戳
    ]);
    await musicApi.playlistTrackAll(cfg, 99, 500, 0);
    await musicApi.like(cfg, 1, true);
    const r = await musicApi.playlistTrackAll(cfg, 99, 500, 0);
    expect(r.songs).toHaveLength(1);
    expect(bodies).toHaveLength(3);
    expect(bodies[0].t).toBeUndefined();
    expect(typeof bodies[2].t).toBe('number');
  });

  it('checks playlistAdd results too', async () => {
    mockFetch([{ status: 200, body: { code: 502, message: '歌单内歌曲重复' } }]);
    await expect(musicApi.playlistAdd(cfg, 5, [1])).rejects.toThrow('歌单内歌曲重复');
  });
});
