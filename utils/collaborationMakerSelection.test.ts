import { describe, expect, it } from 'vitest';
import { changeMakerSelection, makerDraftSeed } from '../features/collaboration/makerSelection';
import { buildCollaborationModelMessages } from '../features/collaboration/context';
import { COLLABORATION_MAKER_MAP } from '../features/collaboration/makers';

describe('cancel accidental collaboration maker selection', () => {
  it('toggles a selected maker off and clears only its untouched seed', () => {
    const selected = changeMakerSelection(undefined, 'bubble-theme', '');
    expect(selected.makerKind).toBe('bubble-theme');
    expect(changeMakerSelection(selected.makerKind, 'bubble-theme', selected.draft)).toEqual({ makerKind: undefined, draft: '' });
  });
  it('keeps the user draft when cancelling or switching types', () => {
    for (const kind of [undefined, 'bubble-theme', 'journal-css'] as const) {
      expect(changeMakerSelection('bubble-theme', kind, '继续整理我上传的报告').draft).toBe('继续整理我上传的报告');
    }
    expect(changeMakerSelection('bubble-theme', undefined, makerDraftSeed('bubble-theme') + '蓝色').draft).toContain('蓝色');
  });
  it('switches an untouched helper without leaving the old bubble instruction behind', () => {
    expect(changeMakerSelection('bubble-theme', 'journal-css', makerDraftSeed('bubble-theme'))).toEqual({
      makerKind: 'journal-css', draft: makerDraftSeed('journal-css'),
    });
  });
  it('removes the actual maker system prompt after explicit cancellation or clearing input', () => {
    for (const draft of ['', makerDraftSeed('bubble-theme')]) {
      const next = changeMakerSelection('bubble-theme', undefined, draft);
      const request = buildCollaborationModelMessages('角色背景', [
        { id: 'old', sessionId: 's', role: 'user', content: makerDraftSeed('bubble-theme'), createdAt: 1 },
        { id: 'new', sessionId: 's', role: 'user', content: '刚才是误触，继续做报告', createdAt: 2 },
      ], next.makerKind);
      expect(request.some(message => message.role === 'system' && message.content === COLLABORATION_MAKER_MAP['bubble-theme'].prompt)).toBe(false);
      expect(request.some(message => message.role === 'system' && typeof message.content === 'string' && message.content.includes('当前未选择专用制作类型'))).toBe(true);
      expect(request.at(-1)?.content).toContain('继续做报告');
    }
  });
});
