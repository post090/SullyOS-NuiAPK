import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioApiConfig, CharacterProfile, CharMusicReview, Message, UserProfile } from '../types';
import { ChatPrompts } from './chatPrompts';
import { DB } from './db';
import * as blobRef from './blobRef';
import { normalizeApiConfig } from './apiConfigNormalize';
import {
  audioFormatFromMime,
  audioMimeFromName,
  buildListenInstructions,
  buildTestToneWav,
  ensureAudioBlob,
  isAudioApiReady,
  lrcToPlainLyrics,
  materializeAudioDescriptions,
  songListenReviewMode,
} from './audioApi';
import {
  buildListenSongGuide,
  buildRecentListenBlock,
  filterListenSources,
  isListenSongEnabled,
  resolveListenCandidate,
  type ListenCandidate,
  type ListenSource,
} from './songListening';
import type { Song } from '../context/MusicContext';

const config: AudioApiConfig = {
  enabled: true,
  baseUrl: 'https://audio.example.com/v1',
  apiKey: 'audio-key',
  model: 'gemini-2.5-flash',
  songQuality: 'exhigh',
};

const song = (id: number, name: string, artists: string): Song => ({
  id, name, artists, album: '', albumPic: '', duration: 0, fee: 0,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('audio API config', () => {
  it('requires every field and the switch', () => {
    expect(isAudioApiReady(config)).toBe(true);
    expect(isAudioApiReady({ ...config, enabled: false })).toBe(false);
    expect(isAudioApiReady({ ...config, model: ' ' })).toBe(false);
    expect(isAudioApiReady(undefined)).toBe(false);
  });

  it('normalizes song quality and trims credentials', () => {
    const normalized = normalizeApiConfig({
      baseUrl: '', apiKey: '', model: '',
      audioApi: { enabled: true, baseUrl: ' https://a.example.com/v1/ ', apiKey: '\u200Bk ', model: ' m ', songQuality: 'bogus' as any },
    });
    expect(normalized.audioApi).toEqual({ enabled: true, baseUrl: 'https://a.example.com/v1', apiKey: 'k', model: 'm', songQuality: 'exhigh' });
    expect(normalizeApiConfig({ baseUrl: '', apiKey: '', model: '', audioApi: { ...config, songQuality: 'lossless' } }).audioApi?.songQuality).toBe('lossless');
  });

  it('maps mime types to input_audio formats', () => {
    expect(audioFormatFromMime('audio/mpeg')).toBe('mp3');
    expect(audioFormatFromMime('audio/x-wav')).toBe('wav');
    expect(audioFormatFromMime('', 'song.flac?x=1')).toBe('flac');
    expect(audioFormatFromMime('application/octet-stream', 'weird.bin')).toBe('mp3');
  });

  it('infers audio mime from file names with punctuation', () => {
    expect(audioMimeFromName('【现场】 歌名 - 歌手 (Live)，版本！.mp3')).toBe('audio/mpeg');
    expect(audioMimeFromName('a.b c.FLAC')).toBe('audio/flac');
    expect(audioMimeFromName('无后缀')).toBeNull();
    expect(audioMimeFromName('doc.pdf')).toBeNull();
  });

  it('rewraps octet-stream picks as audio blobs', () => {
    const raw = new File([new Uint8Array([1, 2, 3])], '【Demo】 歌.m4a', { type: 'application/octet-stream' });
    const wrapped = ensureAudioBlob(raw);
    expect(wrapped.type).toBe('audio/mp4');
    expect(wrapped.size).toBe(3);
    const ok = new File([new Uint8Array([1])], 'x.mp3', { type: 'audio/mpeg' });
    expect(ensureAudioBlob(ok)).toBe(ok);
    const unknown = new File([new Uint8Array([1])], 'x.bin', { type: '' });
    expect(ensureAudioBlob(unknown)).toBe(unknown);
  });

  it('builds a valid wav test tone', async () => {
    const wav = buildTestToneWav();
    const head = new TextDecoder().decode(new Uint8Array(await wav.arrayBuffer()).slice(0, 4));
    expect(wav.type).toBe('audio/wav');
    expect(head).toBe('RIFF');
  });

  it('strips lrc timestamps and credit lines', () => {
    expect(lrcToPlainLyrics('[00:00.00] 作词 : 某人\n[00:12.30]第一句\n[00:15.00]第二句')).toBe('第一句\n第二句');
  });
});

describe('chat audio messages', () => {
  const audioMessage = (id: number, metadata?: Record<string, unknown>): Message => ({
    id, charId: 'char-1', role: 'user', type: 'audio', content: 'blobref:b_audio1',
    timestamp: 1_700_000_000_000 + id, metadata: { fileName: '海边.mp3', ...metadata },
  });

  it('describes an audio message once and caches it in metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '海浪声，远处有人在笑。' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(blobRef, 'getBlobForRef').mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }));
    const updateSpy = vi.spyOn(DB, 'updateMessageMetadata').mockResolvedValue(undefined);

    const prepared = await materializeAudioDescriptions([audioMessage(1)], config);
    expect(prepared[0].metadata?.audioDescription).toBe('海浪声，远处有人在笑。');
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gemini-2.5-flash');
    expect(body.messages[0].content[1]).toEqual({ type: 'input_audio', input_audio: { data: 'AQID', format: 'mp3' } });

    fetchMock.mockClear();
    await materializeAudioDescriptions(prepared, config);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when the audio API is off', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const input = [audioMessage(2)];
    expect(await materializeAudioDescriptions(input, { ...config, enabled: false })).toBe(input);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders audio as text for the main model, never the blob token', () => {
    const char = { id: 'char-1', name: '角色' } as CharacterProfile;
    const user = { name: '我' } as UserProfile;
    const { apiMessages } = ChatPrompts.buildMessageHistory(
      [audioMessage(3, { audioDescription: '一段钢琴独奏。' }), audioMessage(4)],
      20, char, user, [],
    );
    const texts = apiMessages.map(m => String(m.content));
    expect(texts[0]).toContain('你听到的内容：一段钢琴独奏。');
    expect(texts[1]).toContain('听不到声音');
    expect(texts.join('\n')).not.toContain('blobref:');
  });
});

describe('song listening', () => {
  const candidates: ListenCandidate[] = [
    { song: song(1, '晴天', '周杰伦'), origin: 'user', label: '用户的歌单' },
    { song: song(2, '晴天', '别的歌手'), origin: 'char', label: '你的歌单' },
    { song: song(3, '夜曲', '周杰伦'), origin: 'char', label: '你的歌单' },
  ];

  it('only resolves songs from the candidate list, preferring the character own copy', () => {
    expect(resolveListenCandidate(candidates, '晴天')?.song.id).toBe(2);
    expect(resolveListenCandidate(candidates, '晴天 - 周杰伦')?.song.id).toBe(1);
    expect(resolveListenCandidate(candidates, '《夜曲》')?.song.id).toBe(3);
    expect(resolveListenCandidate(candidates, '不存在的歌')).toBeNull();
  });

  it('lists candidates and the tag syntax in the guide', () => {
    const guide = buildListenSongGuide(candidates, '小明');
    expect(guide).toContain('[[LISTEN_SONG:歌名]]');
    expect(guide).toContain('《夜曲》— 周杰伦');
    expect(guide).toContain('小明 的歌');
    expect(buildListenSongGuide([], '小明')).toBe('');
  });

  it('filters listen sources by the per-character selection', () => {
    const src = (key: string, origin: 'char' | 'user'): ListenSource => ({ key, origin, title: key, label: key, songs: [] });
    const netease = Array.from({ length: 15 }, (_, i) => src(`user:netease:${i}`, 'user'));
    const all = [src('char:a', 'char'), src('user:local', 'user'), ...netease];
    expect(filterListenSources(all).map(s => s.key)).toHaveLength(2 + 12);
    expect(filterListenSources(all, ['char:a', 'user:netease:14']).map(s => s.key)).toEqual(['char:a', 'user:netease:14']);
    expect(filterListenSources(all, [])).toEqual([]);
    expect(isListenSongEnabled({} as CharacterProfile)).toBe(true);
    expect(isListenSongEnabled({ listenSongConfig: { enabled: false } } as CharacterProfile)).toBe(false);
  });

  it('samples long candidate lists instead of always showing the first ones', () => {
    const many: ListenCandidate[] = Array.from({ length: 40 }, (_, i) => ({ song: song(i + 1, `歌${i + 1}`, '某人'), origin: 'user', label: '' }));
    const guide = buildListenSongGuide(many, '小明', () => 0);
    expect(guide.match(/《歌\d+》/g)).toHaveLength(15);
    expect(guide).not.toContain('《歌1》');
  });

  it('builds a character-voiced listening prompt with the music taste', () => {
    const char = { id: 'c', name: '阿澈', musicProfile: { bio: '只听后摇和老派爵士', genreTags: ['后摇'], signatureArtists: [{ name: '惘闻', starred: true }] } } as unknown as CharacterProfile;
    const prompt = buildListenInstructions({
      char, user: { name: '小明' } as UserProfile, song: song(1, '晴天', '周杰伦'),
      audio: { base64: '', format: 'mp3', bytes: 0 }, mode: 'together',
    });
    expect(prompt).toContain('像 阿澈');
    expect(prompt).toContain('只听后摇和老派爵士');
    expect(prompt).toContain('惘闻（最爱）');
    expect(prompt).toContain('身边的 小明');
  });

  it('injects only fresh listening diaries on the next turn', () => {
    const now = 1_800_000_000_000;
    const review = (id: string, createdAt: number): CharMusicReview => ({
      id, targetType: 'song', targetId: '1', targetTitle: '晴天', content: '前奏一响我就想起那年夏天。', createdAt,
    });
    const char = { id: 'c', name: '角色', musicProfile: { reviews: [
      review('listen-together-1-1', now - 60_000),
      review('listen-alone-3-1', now - 5 * 3600_000),
      review('vr-other', now - 1000),
    ] } } as unknown as CharacterProfile;
    const block = buildRecentListenBlock(char, '小明', now);
    expect(block).toContain('和 小明 一起从头到尾听完了《晴天》');
    expect(block).toContain('前奏一响');
    expect(block.match(/听完了/g)).toHaveLength(1);
    expect(songListenReviewMode(review('listen-alone-3-1', 0))).toBe('alone');
    expect(buildRecentListenBlock({ ...char, musicProfile: { reviews: [] } } as any, '小明', now)).toBe('');
  });
});
