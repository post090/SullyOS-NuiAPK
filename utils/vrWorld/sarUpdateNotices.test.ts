import { expect, it, vi } from 'vitest';
it('shows the September 16 board notice despite the old notice being read, then remembers completion', async () => {
    vi.resetModules(); localStorage.clear();
    localStorage.setItem('sar-feature-update-september-v1:board', 'done');
    const notices = await import('./sarUpdateNotices');
    expect(notices.hasReadSARUpdateNotice('board')).toBe(false);
    expect(notices.SAR_UPDATE_NOTICES.board.map(l => l.expression)).toEqual(['happy', 'normal', 'normal', 'curious', 'embarrassed', 'normal', 'normal2', 'happy']);
    expect(notices.SAR_UPDATE_NOTICES.board).toHaveLength(8);
    notices.acknowledgeSARUpdateNotice('board');
    vi.resetModules();
    expect((await import('./sarUpdateNotices')).hasReadSARUpdateNotice('board')).toBe(true);
    expect(notices.sarUpdateNoticeKey('cabinet')).toBe('sar-feature-update-september-v1:cabinet');
});
