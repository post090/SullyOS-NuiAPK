import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Live2D update notification references', () => {
  it('replaces the theater popup with the Live2D release and its two promised features', () => {
    const source = readFileSync(path.resolve(__dirname, '../components/UpdateNotificationEvent.tsx'), 'utf8');

    expect(source).not.toContain('StoryPremierePopup');
    expect(source).not.toContain('STORY_FEATURES');
    expect(source).toContain('Live2DUpdatePopup');
    expect(source).toContain("UPDATE_NOTIFICATION_KEY_2026_08_10 = 'sullyos_update_2026_08_10_live2d_seen'");
    expect(source).toContain("eyebrow: '视频通话'");
    expect(source).toContain("eyebrow: 'L2D 陪伴桌面'");
    expect(source).toContain('sessionStorage.setItem(FAQ_TARGET_SECTION_KEY, CHANGELOG_2026_08_10)');
  });

  it('keeps the handbook card and detail page linked to the same changelog id', () => {
    const faqSource = readFileSync(path.resolve(__dirname, '../apps/FAQApp.tsx'), 'utf8');
    const detailSource = readFileSync(path.resolve(__dirname, '../public/changelogs/2026-8-10.html'), 'utf8');

    expect(faqSource).toContain('id: CHANGELOG_2026_08_10');
    expect(faqSource).toContain("src: 'changelogs/2026-8-10.html'");
    expect(detailSource).toContain('新增视频通话');
    expect(detailSource).toContain('新增面向 L2D 的桌面主题');
  });
});
