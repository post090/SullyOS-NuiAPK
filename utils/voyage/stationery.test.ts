// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import VoyageApp from '../../apps/VoyageApp';
import * as invitations from './invitations';
import type { VoyageMood } from './letter';

vi.mock('../../context/OSContext', () => ({
    useOS: () => ({
        characters: [{ id: 'reader', name: '收件人', avatar: '' }],
        theme: { darkMode: false }, activeCharacterId: 'reader',
    }),
}));

it.each([undefined, '慢悠悠'] satisfies (VoyageMood | undefined)[])('shows only the sticker the recipient put on the reply (%s)', async moodSticker => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(invitations, 'listInvitations').mockResolvedValue([{
        id: 'letter', charId: 'reader', sentAt: 1, occasion: 'gift', note: '',
        reply: { at: 2, decision: 'accept', text: '我想去走走。', moodSticker },
        ...(moodSticker && { approvedPlan: { version: 1, digest: 'a'.repeat(64), content: {
            destination: '河口', outline: '沿河散步', weather: '出发前再核对预报', alternatives: '雨天可去展厅', sources: [],
        } } }),
    }]);
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
        await act(async () => root.render(React.createElement(VoyageApp)));
        const letter = await vi.waitFor(() => {
            const row = Array.from(host.querySelectorAll('button')).find(button => button.querySelector('strong')?.textContent === '收件人');
            expect(row).toBeDefined();
            return row!;
        });
        await act(async () => letter.click());
        expect(host.textContent).toContain('我想去走走。');
        const sticker = host.querySelector('[data-mood]');
        expect(sticker?.textContent).toBe(moodSticker);
        expect(sticker?.getAttribute('aria-label')).toBe(moodSticker && '回信心情贴纸 ' + moodSticker);
        expect(host.textContent).not.toContain('·');
        if (moodSticker) {
            expect(host.querySelector('h1')?.textContent).toBe('旅行手账');
            expect(host.querySelector('.voyage-book-title')?.textContent).toContain('出发前');
            const open = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('查看行程'));
            await act(async () => open!.click());
            expect(host.querySelector('h1')?.textContent).toBe('行程册');
            expect(host.querySelector('.voyage-weather')?.textContent).toContain('出发前再核对预报');
            await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="返回"]')!.click());
            expect(host.querySelector('h1')?.textContent).toBe('旅行手账');
        }
    } finally {
        await act(async () => root.unmount());
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    }
});
