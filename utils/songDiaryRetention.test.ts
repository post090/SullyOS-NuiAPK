import { afterEach, expect, it, vi } from 'vitest';
import { DB } from './db';
import { saveSongListenReview } from './audioApi';
import type { CharacterProfile, CharMusicReview } from '../types';
afterEach(() => vi.restoreAllMocks());
it('keeps more than 50 listening diaries without truncation', async () => {
  const reviews = Array.from({ length: 60 }, (_, i): CharMusicReview => ({ id: `listen-alone-${i}`, targetType: 'song', targetId: String(i), targetTitle: `song ${i}`, content: 'diary', createdAt: i }));
  const char = { id: 'c', musicProfile: { reviews } } as CharacterProfile;
  vi.spyOn(DB, 'getCharacter').mockResolvedValue(char);
  const save = vi.spyOn(DB, 'saveCharacter').mockResolvedValue(undefined);
  await saveSongListenReview('c', { id: 99, name: 'new song' }, 'new diary');
  const stored = save.mock.calls[0][0].musicProfile!.reviews!;
  expect(stored).toHaveLength(61);
  expect(stored[0]).toEqual(reviews[0]);
  expect(stored[60].content).toBe('new diary');
});
it('retains existing same-song replacement behavior without dropping other songs', async () => {
  const old: CharMusicReview = { id: 'listen-alone-1', targetType: 'song', targetId: '1', targetTitle: 'song', content: 'old', createdAt: 1 };
  vi.spyOn(DB, 'getCharacter').mockResolvedValue({ id: 'c', musicProfile: { reviews: [old] } } as CharacterProfile);
  const save = vi.spyOn(DB, 'saveCharacter').mockResolvedValue(undefined);
  await saveSongListenReview('c', { id: 1, name: 'song' }, 'new');
  expect(save.mock.calls[0][0].musicProfile!.reviews).toHaveLength(1);
  expect(save.mock.calls[0][0].musicProfile!.reviews![0].content).toBe('new');
});
