import type { AudioApiConfig, CharacterProfile, CharMusicReview, CharPlaylistSong } from '../types';
import { DB } from './db';
import { normalizeApiConfig } from './apiConfigNormalize';
import { neteaseCacheGet } from './neteaseCache';
import {
  audioBlobToPayload,
  fetchSongAudio,
  fetchSongLyrics,
  findSongListenReview,
  isAudioApiReady,
  listenToSongAsCharacter,
  saveSongListenReview,
  songListenReviewMode,
  SONG_LISTEN_REVIEW_PREFIX,
} from './audioApi';
import {
  loadLocalAlbumStandalone,
  loadMusicCfgStandalone,
  loadNeteaseUidStandalone,
  type Song,
} from '../context/MusicContext';

export type SongListenMode = 'together' | 'alone';

/** 听后感在多久内算「刚听完」，会在下一轮聊天注入给主模型。 */
export const RECENT_LISTEN_WINDOW_MS = 90 * 60 * 1000;

/** 角色自己挑歌重听时，旧日记多久以内直接沿用、不再重新调一次音频模型。 */
const ALONE_RELISTEN_REUSE_MS = 30 * 24 * 3600 * 1000;

export const loadAudioApiConfig = (): AudioApiConfig | null => {
  try {
    const raw = localStorage.getItem('os_api_config');
    if (!raw) return null;
    return normalizeApiConfig(JSON.parse(raw)).audioApi ?? null;
  } catch {
    return null;
  }
};

export const isSongListeningAvailable = (): boolean => isAudioApiReady(loadAudioApiConfig());

export interface SongListenOutcome {
  status: 'listened' | 'reused' | 'skipped' | 'failed';
  review?: CharMusicReview;
  isTrial?: boolean;
  error?: string;
}

const inFlight = new Map<string, Promise<SongListenOutcome>>();

/**
 * 让角色真的听一遍这首歌：取音频 + 歌词 → 带人设单独调用音频模型 → 写成听歌日记。
 * - together：只在这首歌第一次一起听时触发，已有日记直接跳过。
 * - alone：角色主动挑的；一个月内听过就沿用旧日记（刷新时间，让下一轮能带上）。
 */
export function startSongListen(charId: string, song: Song, mode: SongListenMode): Promise<SongListenOutcome> {
  const key = `${charId}:${song.id}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = runSongListen(charId, song, mode).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

async function runSongListen(charId: string, song: Song, mode: SongListenMode): Promise<SongListenOutcome> {
  const config = loadAudioApiConfig();
  if (!isAudioApiReady(config)) return { status: 'skipped' };
  const [char, user] = await Promise.all([DB.getCharacter(charId), DB.getUserProfile()]);
  if (!char?.musicProfile || !user) return { status: 'skipped' };

  const cached = findSongListenReview(char, song.id);
  if (cached) {
    if (mode === 'together') return { status: 'skipped', review: cached };
    if (Date.now() - cached.createdAt < ALONE_RELISTEN_REUSE_MS) {
      const review = await saveSongListenReview(charId, song, cached.content, 'alone');
      return { status: 'reused', review: review ?? cached };
    }
  }

  try {
    const cfg = loadMusicCfgStandalone();
    const [audio, lyrics] = await Promise.all([
      fetchSongAudio(song, cfg, config.songQuality || 'exhigh'),
      fetchSongLyrics(song, cfg),
    ]);
    const payload = await audioBlobToPayload(audio.blob, audio.nameHint);
    const content = await listenToSongAsCharacter({
      char, user, song, audio: payload, lyrics, isTrial: audio.isTrial, mode,
    }, config);
    const review = await saveSongListenReview(charId, song, content, mode);
    if (!review) return { status: 'failed', error: '角色没有音乐档案' };
    return { status: 'listened', review, isTrial: audio.isTrial };
  } catch (error: any) {
    console.warn('[songListening] 听歌失败', error);
    return { status: 'failed', error: error?.message || String(error) };
  }
}

/** 下一轮注入：最近刚听完的歌和角色自己的听后感。 */
export function buildRecentListenBlock(char: CharacterProfile, userName: string, now = Date.now()): string {
  const reviews = (char.musicProfile?.reviews || [])
    .filter(r => r.targetType === 'song' && r.id.startsWith(SONG_LISTEN_REVIEW_PREFIX) && now - r.createdAt <= RECENT_LISTEN_WINDOW_MS)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2);
  if (reviews.length === 0) return '';
  const lines = ['### 【你刚刚真的听过的歌】'];
  for (const review of reviews) {
    const how = songListenReviewMode(review) === 'together' ? `和 ${userName || '对方'} 一起` : '自己一个人';
    lines.push(`你${how}从头到尾听完了《${review.targetTitle}》。听完后你在听歌日记里写下：`);
    lines.push(review.content.split('\n').map(l => `  ${l}`).join('\n'));
  }
  lines.push(`（这些是你亲耳听到后的真实感受，聊起这首歌时以此为准，不要编造没听到的细节。想说就自然地说，不想说也不必特意提起，更不要每轮重复。）`);
  return `${lines.join('\n')}\n`;
}

export interface ListenCandidate {
  song: Song;
  origin: 'char' | 'user';
  /** 来源说明，给角色看的，例如「你的歌单《夜路》」 */
  label: string;
}

const playlistSongToSong = (s: CharPlaylistSong, localById: Map<number, Song>): Song =>
  localById.get(s.id) ?? {
    id: s.id, name: s.name, artists: s.artists, album: s.album, albumPic: s.albumPic, duration: s.duration, fee: s.fee,
  };

interface HomeSnapshotLite { playlists?: { id: number; name: string }[] }

/** 角色能主动挑来听的歌：自己的歌单 + 用户的歌（本地专辑、播放队列、已缓存的网易云歌单）。 */
export async function collectListenCandidates(char: CharacterProfile, userName: string): Promise<ListenCandidate[]> {
  const out: ListenCandidate[] = [];
  const seen = new Set<number>();
  const push = (song: Song, origin: ListenCandidate['origin'], label: string) => {
    if (!song?.id || !song.name || seen.has(song.id)) return;
    seen.add(song.id);
    out.push({ song, origin, label });
  };
  const localAlbum = loadLocalAlbumStandalone();
  const localById = new Map(localAlbum.map(s => [s.id, s]));
  const who = userName || '对方';

  for (const pl of char.musicProfile?.playlists || []) {
    for (const s of pl.songs) push(playlistSongToSong(s, localById), 'char', `你的歌单《${pl.title}》`);
  }
  for (const s of localAlbum) push(s, 'user', `${who}的本地专辑`);
  try {
    const raw = localStorage.getItem('sully_music_state_v1');
    const queue: Song[] = raw ? (JSON.parse(raw)?.queue || []) : [];
    for (const s of queue) push(s, 'user', `${who}的播放列表`);
  } catch { /* ignore */ }
  const uid = loadNeteaseUidStandalone();
  if (uid) {
    const home = await neteaseCacheGet<HomeSnapshotLite>(`home:${uid}`);
    for (const pl of (home?.data?.playlists || []).slice(0, 12)) {
      const hit = await neteaseCacheGet<Song[]>(`pl:${pl.id}`);
      for (const s of (hit?.data || [])) push(s, 'user', `${who}的歌单《${pl.name}》`);
    }
  }
  return out;
}

const normalizeTitle = (value: string) => value.toLowerCase().replace(/[《》「」"'“”\s]/g, '');

/** 按角色写的「歌名」或「歌名 - 歌手」在候选里找歌；找不到返回 null（不允许听候选以外的歌）。 */
export function resolveListenCandidate(candidates: ListenCandidate[], query: string): ListenCandidate | null {
  const [rawName, rawArtist] = query.split(/\s+[-—–]\s+|\s*\|\s*/);
  const name = normalizeTitle(rawName || '');
  const artist = normalizeTitle(rawArtist || '');
  if (!name) return null;
  const byName = candidates.filter(c => normalizeTitle(c.song.name) === name);
  const pool = byName.length > 0 ? byName : candidates.filter(c => {
    const n = normalizeTitle(c.song.name);
    return n.includes(name) || name.includes(n);
  });
  if (pool.length === 0) return null;
  if (artist) {
    const withArtist = pool.find(c => normalizeTitle(c.song.artists).includes(artist));
    if (withArtist) return withArtist;
  }
  return pool.find(c => c.origin === 'char') ?? pool[0];
}

const GUIDE_CHAR_LIMIT = 15;
const GUIDE_USER_LIMIT = 15;

/** 音频识别 API 开着时才注入：告诉角色可以挑一首歌真的去听。 */
export function buildListenSongGuide(candidates: ListenCandidate[], userName: string): string {
  if (candidates.length === 0) return '';
  const own = candidates.filter(c => c.origin === 'char').slice(0, GUIDE_CHAR_LIMIT);
  const theirs = candidates.filter(c => c.origin === 'user').slice(0, GUIDE_USER_LIMIT);
  const fmt = (c: ListenCandidate) => `《${c.song.name}》— ${c.song.artists}`;
  const lines = ['### 【戴上耳机】', `你可以挑一首歌真的去听（会从头听到尾，听完你会有自己的感受）。只能从你自己的歌单或 ${userName || '对方'} 的歌里挑：`];
  if (own.length) lines.push(`你的歌：${own.map(fmt).join('、')}`);
  if (theirs.length) lines.push(`${userName || '对方'} 的歌：${theirs.map(fmt).join('、')}`);
  lines.push('想听时在回复里单独写一行 `[[LISTEN_SONG:歌名]]`（重名可写 `[[LISTEN_SONG:歌名 - 歌手]]`），一条回复最多一首。只在你真的想听的时候用，不要每轮都听；对方在放的歌你已经能一起听了，不用再点。');
  return `${lines.join('\n')}\n`;
}
