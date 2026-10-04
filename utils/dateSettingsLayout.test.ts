// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import DateSettings from '../components/date/DateSettings';

vi.mock('../context/OSContext', () => ({ useOS: () => ({ updateCharacter: vi.fn(), addToast: vi.fn(), userProfile: { name: '用户' } }) }));
vi.mock('../components/date/MeetingAppearanceControl', () => ({ default: () => React.createElement('div', null, '当前美化') }));
vi.mock('../components/date/ObserveSettings', () => ({ default: () => null }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('scrolls the preview with the editor, collapses it, and keeps focused input above a reduced viewport', async () => {
    const viewport = Object.assign(new EventTarget(), { scale: 1, offsetTop: 0, height: 380 });
    vi.stubGlobal('visualViewport', viewport);
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => root.render(React.createElement(DateSettings, { char: { id: 'test', name: '角色' } as any, onBack: vi.fn() })));
        const scroll = host.querySelector('[data-testid="date-settings-scroll"]') as HTMLElement;
        const toggle = [...host.querySelectorAll('button')].find(el => el.textContent === '收起场景预览')!;
        expect(scroll.contains(toggle)).toBe(true);
        expect(scroll.textContent).toContain('预览 (Preview)');
        await act(async () => toggle.click());
        expect(scroll.textContent).not.toContain('预览 (Preview)');
        expect(toggle.textContent).toBe('展开场景预览');
        const textarea = host.querySelector('textarea[aria-label="自定义补充"]') as HTMLTextAreaElement;
        vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue({ top: 64, bottom: 380, height: 316 } as DOMRect);
        vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({ top: 500, bottom: 580, height: 80 } as DOMRect);
        await act(async () => {
            textarea.focus(); viewport.dispatchEvent(new Event('resize'));
            await new Promise(resolve => requestAnimationFrame(resolve));
        });
        expect((host.firstElementChild as HTMLElement).style.maxHeight).toBe('380px');
        expect(scroll.scrollTop).toBe(208);
    } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
});
