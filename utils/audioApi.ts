import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { AudioApiConfig, AudioApiSongQuality, CharacterProfile, CharMusicReview, Message, UserProfile } from '../types';
import { DB } from './db';
import { extractContent, safeFetchJson } from './safeApi';
import { ContextBuilder } from './context';
import { getBlobForRef, isBlobRef } from './blobRef';
import { musicApi, type MusicCfg, type Song } from '../context/MusicContext';

export const AUDIO_DESCRIPTION_METADATA_KEY = 'audioDescription';

/** 听歌请求的上限：base64 后约 1.34 倍，留出余量避免中转站因请求体过大直接拒收。 */
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

export const AUDIO_SONG_QUALITY_OPTIONS: { value: AudioApiSongQuality; label: string }[] = [
  { value: 'standard', label: '标准（128kbps，最省，几乎所有中转都能收）' },
  { value: 'exhigh', label: '极高（320kbps，推荐）' },
  { value: 'lossless', label: '无损（体积大，可能被中转拒收；超限自动降到极高）' },
];

const AUDIO_DESCRIBE_PROMPT = `请认真听这段音频，写一段准确、具体的文字说明，供另一个听不到声音的对话模型理解。
如果是人说话：先尽量逐字转写，再简述语气、情绪和背景声。
如果是音乐：说明风格、情绪、节奏快慢、主要乐器与人声特点、结构上的变化，能听清的歌词也写出来。
其他声音：描述听到了什么、可能在什么场景。
不要猜测听不出来的信息，不要寒暄，只输出说明正文。`;

export const isAudioApiReady = (config?: AudioApiConfig | null): config is AudioApiConfig =>
  config?.enabled === true
  && !!config.baseUrl?.trim()
  && !!config.apiKey?.trim()
  && !!config.model?.trim();

const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const AUDIO_FORMAT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mpga': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/flac': 'flac', 'audio/x-flac': 'flac',
  'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/x-aac': 'aac',
  'audio/ogg': 'ogg', 'audio/webm': 'webm',
};

/** 输入音频的格式名：OpenAI 只认 mp3/wav，Gemini 等兼容端还能收 flac/m4a/ogg 等。 */
export const audioFormatFromMime = (mime: string, fallbackName = ''): string => {
  const normalized = (mime || '').split(';')[0].trim().toLowerCase();
  if (AUDIO_FORMAT_BY_MIME[normalized]) return AUDIO_FORMAT_BY_MIME[normalized];
  const ext = fallbackName.split('?')[0].split('.').pop()?.toLowerCase() || '';
  return ext && Object.values(AUDIO_FORMAT_BY_MIME).includes(ext) ? ext : 'mp3';
};

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/x-wav', m4a: 'audio/mp4', aac: 'audio/aac',
  flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm',
};

/**
 * 由文件名后缀推断音频 MIME，认不出返回 null。
 * 名字里的空格、中文、【】等标点都不影响判断（只看最后一个 `.` 之后的部分）。
 */
export const audioMimeFromName = (name: string): string | null => {
  const ext = (name || '').split('?')[0].split('.').pop()?.toLowerCase() || '';
  return AUDIO_MIME_BY_EXT[ext] ?? null;
};

/**
 * 归一化选中的音频文件。部分安卓 ROM 从文件名推 MIME 时对空格/【】等字符解析失败，
 * JS 拿到的 File 是 application/octet-stream；这类文件按扩展名重包装成正确音频 MIME
 * 的 Blob，保证 <audio> 能播、时长能读、识别 API 能拿到正确格式。
 * 本来就有音频 MIME 的原样返回，不做复制。
 */
export const ensureAudioBlob = (blob: Blob, nameHint = ''): Blob => {
  if ((blob.type || '').startsWith('audio/')) return blob;
  const name = blob instanceof File ? blob.name : nameHint;
  const mime = audioMimeFromName(name || '');
  return mime ? new Blob([blob], { type: mime }) : blob;
};

/**
 * 音频选择器的 accept 值。网页端用 audio/*（系统对话框按 MIME 过滤，工作正常）；
 * 原生 APK 里，部分安卓 ROM 从文件名推 MIME 时对空格/【】等字符会解析失败，把明明
 * 是音频的文件当未知类型，按 audio/* 过滤的选择器会把这些文件静默丢掉（选完毫无
 * 反应）。所以原生端不设 accept，可选任何文件，由 JS 按 MIME / 扩展名校验并给出
 * 明确提示兜底。
 */
export const AUDIO_PICKER_ACCEPT: string | undefined = isNative() ? undefined : 'audio/*';

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
};

const base64ToBlob = (base64: string, mime: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

export interface AudioPayload {
  base64: string;
  format: string;
  bytes: number;
}

export const audioBlobToPayload = async (blob: Blob, nameHint = ''): Promise<AudioPayload> => {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error(`音频太大（${(blob.size / 1024 / 1024).toFixed(1)}MB），超过 ${MAX_AUDIO_BYTES / 1024 / 1024}MB 上限`);
  }
  return { base64: await blobToBase64(blob), format: audioFormatFromMime(blob.type, nameHint), bytes: blob.size };
};

/** 下载一个音频地址。网易云 CDN 带 `Access-Control-Allow-Origin: *`，网页可直接取；原生端走 CapacitorHttp。 */
export async function downloadAudio(url: string, signal?: AbortSignal): Promise<Blob> {
  const target = url.replace(/^http:\/\//i, 'https://');
  if (isNative()) {
    const response = await CapacitorHttp.request({ url: target, method: 'GET', responseType: 'blob' });
    if (response.status < 200 || response.status >= 300) throw new Error(`音频下载失败 (HTTP ${response.status})`);
    const mime = String(response.headers?.['Content-Type'] || response.headers?.['content-type'] || 'audio/mpeg');
    const blob = base64ToBlob(String(response.data || ''), mime);
    if (!blob.size) throw new Error('音频下载结果为空');
    return blob;
  }
  const response = await fetch(target, { signal });
  if (!response.ok) throw new Error(`音频下载失败 (HTTP ${response.status})`);
  const blob = await response.blob();
  if (!blob.size) throw new Error('音频下载结果为空');
  return blob;
}

/** 读音频时长（秒）；读不出来返回 0，不阻塞发送。 */
export const readAudioDuration = (blob: Blob): Promise<number> => new Promise(resolve => {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') { resolve(0); return; }
  const url = URL.createObjectURL(blob);
  const audio = document.createElement('audio');
  let settled = false;
  const done = (value: number) => {
    if (settled) return;
    settled = true;
    URL.revokeObjectURL(url);
    resolve(Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
  };
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => done(audio.duration);
  audio.onerror = () => done(0);
  setTimeout(() => done(0), 5000);
  audio.src = url;
});

const QUALITY_FALLBACK: Record<AudioApiSongQuality, AudioApiSongQuality[]> = {
  lossless: ['lossless', 'exhigh', 'standard'],
  exhigh: ['exhigh', 'standard'],
  standard: ['standard'],
};

export interface SongAudio {
  blob: Blob;
  nameHint: string;
  /** 没带会员 cookie 的 VIP 歌只能拿到试听片段。 */
  isTrial: boolean;
}

/**
 * 取一首歌的音频文件。本地歌（写歌 App 生成）从 IndexedDB 读；网易云歌按选定音质取地址，
 * 文件超过上限就降一档重取。
 */
export async function fetchSongAudio(song: Song, cfg: MusicCfg, quality: AudioApiSongQuality = 'exhigh'): Promise<SongAudio> {
  if (song.local && song.localAssetKey) {
    const entry = await DB.getAssetRaw(song.localAssetKey).catch(() => null) as { blob?: Blob } | Blob | null;
    const blob = entry instanceof Blob ? entry : (entry?.blob instanceof Blob ? entry.blob : null);
    if (!blob) throw new Error('本地歌曲文件丢失');
    if (blob.size > MAX_AUDIO_BYTES) throw new Error('这首本地歌的文件太大，没法发给音频模型');
    return { blob, nameHint: song.localMimeType || '', isTrial: false };
  }
  let lastError: Error | null = null;
  for (const level of QUALITY_FALLBACK[quality] || QUALITY_FALLBACK.exhigh) {
    const res = await musicApi._raw(cfg, '/song/url', { ids: [song.id], level });
    const item = res?.data?.[0];
    const url: string | null = item?.url || null;
    if (!url) {
      lastError = new Error(item?.fee && !cfg.cookie ? '这首需要会员 cookie 才能听' : '这首暂时没有可用的音频地址');
      break;
    }
    if (typeof item.size === 'number' && item.size > MAX_AUDIO_BYTES) {
      lastError = new Error('音频太大');
      continue;
    }
    const blob = await downloadAudio(url);
    if (blob.size > MAX_AUDIO_BYTES) { lastError = new Error('音频太大'); continue; }
    return { blob, nameHint: url, isTrial: !!item.freeTrialInfo };
  }
  throw lastError || new Error('没拿到这首歌的音频');
}

const audioPart = (payload: AudioPayload) => ({
  type: 'input_audio',
  input_audio: { data: payload.base64, format: payload.format },
});

async function callAudioModel(
  config: AudioApiConfig,
  messages: any[],
  meta: { purpose: string; charId?: string; charName?: string },
  maxTokens: number,
  temperature: number,
): Promise<string> {
  if (!isAudioApiReady(config)) throw new Error('音频识别 API 已开启，但 URL、Key 或 Model 尚未填写完整');
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
  const data = await safeFetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` },
    body: JSON.stringify({ model: config.model.trim(), messages, temperature, max_tokens: maxTokens, stream: false }),
  }, 1, 180_000, { appName: '音频识别', ...meta });
  const text = extractContent(data).trim();
  if (!text) throw new Error('音频模型没有返回内容');
  return text;
}

/** 把一段音频变成给纯文本主模型看的说明。 */
export async function describeAudioWithAudioApi(payload: AudioPayload, config: AudioApiConfig): Promise<string> {
  const text = await callAudioModel(config, [{
    role: 'user',
    content: [{ type: 'text', text: AUDIO_DESCRIBE_PROMPT }, audioPart(payload)],
  }], { purpose: '音频识别' }, 1500, 0);
  return text.replace(/\s+\n/g, '\n').trim().slice(0, 4000);
}

/** 设置页「测试」用：生成一段 0.6 秒的 440Hz 正弦波 WAV。 */
export const buildTestToneWav = (): Blob => {
  const sampleRate = 16000;
  const samples = Math.floor(sampleRate * 0.6);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => { for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 12000), true);
  return new Blob([buffer], { type: 'audio/wav' });
};

export interface SongListenInput {
  char: CharacterProfile;
  user: UserProfile;
  song: Pick<Song, 'id' | 'name' | 'artists' | 'album'>;
  audio: AudioPayload;
  lyrics?: string;
  isTrial?: boolean;
  /** 'together' = 和用户一起听；'alone' = 角色自己挑来听。 */
  mode: 'together' | 'alone';
}

/** 角色自己的音乐口味，给听歌时当「耳朵的偏见」用。 */
const buildMusicTasteBlock = (char: CharacterProfile): string => {
  const mp = char.musicProfile;
  if (!mp) return '';
  const lines: string[] = [];
  if (mp.bio?.trim()) lines.push(`你的音乐品味：${mp.bio.trim()}`);
  if (mp.genreTags?.length) lines.push(`你常听的类型：${mp.genreTags.slice(0, 8).join('、')}`);
  const artists = (mp.signatureArtists || []).slice(0, 8).map(a => a.starred ? `${a.name}（最爱）` : a.name);
  if (artists.length) lines.push(`你偏爱的歌手：${artists.join('、')}`);
  return lines.length ? `\n${lines.join('\n')}\n` : '';
};

export const buildListenInstructions = (input: SongListenInput): string => {
  const userName = input.user.name || '对方';
  const charName = input.char.name;
  const scene = input.mode === 'together'
    ? `${userName} 正在播放这首歌，你戴上了另一只耳机，和 ta 一起把它听完。`
    : '你一个人戴着耳机，挑了这首歌从头听到尾，没有人打扰。';
  return `### 【现在：听歌】
${scene}
${buildMusicTasteBlock(input.char)}
听完以后，作为 ${charName} 本人，写一段只给自己看的听歌日记。

最重要的是「像 ${charName}」，而不是「听得准」：
- 用 ${charName} 平时说话的方式写：用词、语气、口头禅、句子长短、标点习惯、会不会装酷或嘴硬，都照你的人设来。一个话少的人可以只写几句短句，一个话多的人可以碎碎念。
- 带着你自己的口味和偏见去听：喜欢就说喜欢，听不惯、觉得吵、觉得矫情、觉得一般也可以直说，不用替这首歌说好话。拿它跟你熟悉的歌或歌手比也行。
- 让歌勾出你自己的东西：某段旋律、某句歌词让你想起了什么人、什么事、你的经历或你最近的心情${input.mode === 'together' ? `，或者此刻身边的 ${userName}` : ''}。这部分比描述音乐本身更重要。
- 声音上的细节只挑一两处真正抓住你的写（某个转音、鼓点进来的那一下、哪句歌词），用你自己的话说，不要用专业乐评的术语堆砌。只写你确实听到的，听不出来的别编。

格式：
- 第一人称，长短按你的性格来，大约 80–300 字。不要列条目，不要打分，不要写成报告。
- 只输出日记正文，不要加标题、引号或任何格式标签。${input.isTrial ? '\n- 你只听到了一段试听片段，不是完整的歌，可以带一句这件事。' : ''}`;
};

/** 带着角色本身的人设与世界书，单独听一遍歌，返回角色第一人称的听后感。 */
export async function listenToSongAsCharacter(input: SongListenInput, config: AudioApiConfig): Promise<string> {
  const lyricsBlock = input.lyrics?.trim()
    ? `\n\n歌词（供你对照着听）：\n${input.lyrics.trim().slice(0, 4000)}`
    : '\n\n（这首没有拿到歌词，靠耳朵听。）';
  const userText = `《${input.song.name}》— ${input.song.artists}${input.song.album ? `（专辑《${input.song.album}》）` : ''}${lyricsBlock}`;
  const messages = ContextBuilder.buildCharacterRequest(
    { char: input.char, user: input.user, instructions: buildListenInstructions(input) },
    [{ role: 'user', content: [{ type: 'text', text: userText }, audioPart(input.audio)] }],
  );
  const text = await callAudioModel(config, messages, {
    purpose: input.mode === 'together' ? '一起听歌' : '角色独自听歌',
    charId: input.char.id,
    charName: input.char.name,
  }, 900, 0.85);
  return text.replace(/^["“「]|["”」]$/g, '').trim().slice(0, 2000);
}

/** 网易云歌词去掉时间轴，拼成纯文本。 */
export const lrcToPlainLyrics = (lrc?: string | null): string => (lrc || '')
  .split(/\r?\n/)
  .map(line => line.replace(/\[[^\]]*\]/g, '').trim())
  .filter(line => line && !/^(作词|作曲|编曲|制作人|混音|母带|录音)\s*[:：]/.test(line))
  .join('\n');

export async function fetchSongLyrics(song: Song, cfg: MusicCfg): Promise<string> {
  if (song.local) return (song.localLyrics || '').split(/\r?\n/).filter(l => l.trim() && !/^\[[^\]]+\]$/.test(l.trim())).join('\n');
  try {
    const res = await musicApi.lyric(cfg, song.id);
    return lrcToPlainLyrics(res?.lrc?.lyric);
  } catch { return ''; }
}

export const SONG_LISTEN_REVIEW_PREFIX = 'listen-';

export const findSongListenReview = (char: CharacterProfile, songId: number): CharMusicReview | undefined =>
  char.musicProfile?.reviews?.find(r => r.targetType === 'song' && r.targetId === String(songId) && r.id.startsWith(SONG_LISTEN_REVIEW_PREFIX));

export const songListenReviewMode = (review: CharMusicReview): 'together' | 'alone' =>
  review.id.startsWith(`${SONG_LISTEN_REVIEW_PREFIX}alone-`) ? 'alone' : 'together';

/** 听后感存成角色的乐评（音乐 App 角色页「听歌日记」可见），同一首歌只保留最新一条。 */
export async function saveSongListenReview(
  charId: string,
  song: Pick<Song, 'id' | 'name'>,
  content: string,
  mode: 'together' | 'alone' = 'together',
): Promise<CharMusicReview | null> {
  const char = await DB.getCharacter(charId);
  if (!char?.musicProfile) return null;
  const review: CharMusicReview = {
    id: `${SONG_LISTEN_REVIEW_PREFIX}${mode}-${song.id}-${Date.now()}`,
    targetType: 'song',
    targetId: String(song.id),
    targetTitle: song.name,
    content,
    createdAt: Date.now(),
  };
  const kept = (char.musicProfile.reviews || []).filter(r => !(r.targetType === 'song' && r.targetId === String(song.id) && r.id.startsWith(SONG_LISTEN_REVIEW_PREFIX)));
  const musicProfile = { ...char.musicProfile, reviews: [...kept, review].slice(-50), updatedAt: Date.now() };
  await DB.saveCharacter({ ...char, musicProfile });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('char-music-profile-updated', { detail: { charId, musicProfile } }));
  }
  return review;
}

export const readAudioDescription = (message: Message): string => {
  const value = message.metadata?.[AUDIO_DESCRIPTION_METADATA_KEY];
  return typeof value === 'string' ? value.trim() : '';
};

const inFlightAudio = new Map<string, Promise<string>>();

/** 聊天里的音频消息先转成文字说明，写回 metadata；同一条只识别一次。 */
export async function materializeAudioDescriptions(messages: Message[], config?: AudioApiConfig | null): Promise<Message[]> {
  if (!isAudioApiReady(config)) return messages;
  const prepared: Message[] = [];
  for (const message of messages) {
    if (message.type !== 'audio' || readAudioDescription(message)) { prepared.push(message); continue; }
    const ref = typeof message.content === 'string' ? message.content : '';
    if (!isBlobRef(ref)) { prepared.push(message); continue; }
    let pending = inFlightAudio.get(ref);
    if (!pending) {
      pending = (async () => {
        const blob = await getBlobForRef(ref);
        if (!blob) throw new Error('音频文件已不可用');
        return describeAudioWithAudioApi(await audioBlobToPayload(blob, message.metadata?.fileName || ''), config);
      })();
      inFlightAudio.set(ref, pending);
    }
    try {
      const description = await pending;
      const metadata = { ...(message.metadata || {}), [AUDIO_DESCRIPTION_METADATA_KEY]: description, audioRecognizedAt: Date.now(), audioModel: config.model.trim() };
      await DB.updateMessageMetadata(message.id, prev => ({ ...(prev || {}), ...metadata }));
      prepared.push({ ...message, metadata });
    } catch (error) {
      console.warn('[audioApi] 音频识别失败，这条按占位发送', error);
      prepared.push(message);
    } finally {
      inFlightAudio.delete(ref);
    }
  }
  return prepared;
}
