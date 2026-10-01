import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIConfig, CharacterProfile } from '../types';
import { fetchRemoteAudioBlob, synthesizeSpeechDetailed } from './minimaxTts';
import { minimaxFetch } from './minimaxEndpoint';
import { getCachedTts, saveCachedTts } from './ttsCache';

vi.mock('./minimaxEndpoint', () => ({ minimaxFetch: vi.fn() }));
vi.mock('./ttsCache', () => ({ hashTtsParams: () => 'test-key', getCachedTts: vi.fn(), saveCachedTts: vi.fn() }));
const char = { id: 'a', voiceProfile: { voiceId: 'voice', minimaxParamVersion: 'natural-v2' } } as CharacterProfile;
const config = { minimaxApiKey: 'test-only' } as APIConfig;
const response = (audio: string) => ({ ok: true, status: 200, json: async () => ({ data: { audio }, base_resp: { status_code: 0 } }) });

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedTts).mockResolvedValue(null);
    vi.mocked(saveCachedTts).mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('MiniMax inline audio transport', () => {
    it('returns a persistent blob with no OSS GET after a successful synthesis', async () => {
        vi.mocked(minimaxFetch).mockResolvedValue(response('49443300'));
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const result = await synthesizeSpeechDetailed('你好', char, config);
        expect(JSON.parse(vi.mocked(minimaxFetch).mock.calls[0][1].body!)).toMatchObject({ stream: false, output_format: 'hex' });
        expect(result.url).toMatch(/^blob:/);
        expect(result.blob?.size).toBe(4);
        expect(saveCachedTts).toHaveBeenCalledWith('test-key', result.blob);
        expect(fetch).not.toHaveBeenCalled();
        URL.revokeObjectURL(result.url);
    });
    it('keeps legacy URL-only providers playable without repeating paid synthesis', async () => {
        const signed = 'https://audio.example.com/a%2Fb.mp3?Signature=x%2By&Expires=123';
        vi.mocked(minimaxFetch).mockResolvedValue(response(signed));
        const fetch = vi.fn().mockRejectedValue(new TypeError('Load failed'));
        vi.stubGlobal('fetch', fetch);
        const result = await synthesizeSpeechDetailed('你好', char, config);
        expect(result).toEqual({ url: signed, blob: null });
        expect(fetch.mock.calls[0][0]).toBe(signed);
        expect(minimaxFetch).toHaveBeenCalledTimes(1);
        expect(saveCachedTts).not.toHaveBeenCalled();
    });
    it('does not hit the API when cached audio is available', async () => {
        const blob = new Blob(['audio'], { type: 'audio/mpeg' });
        vi.mocked(getCachedTts).mockResolvedValue(blob);
        const result = await synthesizeSpeechDetailed('你好', char, config);
        expect(result.blob).toBe(blob);
        expect(minimaxFetch).not.toHaveBeenCalled();
        URL.revokeObjectURL(result.url);
    });
    it('rejects HTML error pages instead of caching them as audio', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>expired</html>', { headers: { 'content-type': 'text/html' } })));
        await expect(fetchRemoteAudioBlob('https://audio.example.com/x')).rejects.toThrow('错误页面');
    });
});
