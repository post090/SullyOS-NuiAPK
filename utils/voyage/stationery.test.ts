// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import VoyageApp from '../../apps/VoyageApp';
import { DB } from '../db';
import * as invitations from './invitations';
import { VOYAGE_CONTEXT_PREFIX, type VoyageMood } from './letter';

vi.mock('../../context/OSContext', () => ({
    useOS: () => ({
        characters: [
            { id: 'reader', name: '收件人', avatar: '', systemPrompt: '第一位的主提示词' },
            { id: 'guest', name: '旅伴', avatar: '', systemPrompt: '第二位的主提示词' },
        ],
        theme: { darkMode: false }, activeCharacterId: 'reader',
    }),
}));

it('opens the active traveller’s settings and switches the ticket and its saved materials together', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(invitations, 'listInvitations').mockResolvedValue([]);
    vi.spyOn(DB, 'getAsset').mockImplementation(async key => key === VOYAGE_CONTEXT_PREFIX + 'guest'
        ? JSON.stringify({ mode: 'custom', prompt: '第二位的手写资料', extraNote: '', worldbookIds: [] }) : null);
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
        await act(async () => root.render(React.createElement(VoyageApp)));
        const open = Array.from(host.querySelectorAll('button')).find(button => button.textContent === '策划资料')!;
        await act(async () => open.click());
        const ticket = host.querySelector<HTMLSelectElement>('select[aria-label="选择角色"]')!;
        expect(ticket.value).toBe('reader');
        expect(host.querySelector('.voyage-ticket-name strong')?.textContent).toBe('收件人');
        expect(host.querySelector('pre')?.textContent).toBe('【角色主提示词】\n第一位的主提示词');
        await act(async () => {
            ticket.value = 'guest';
            ticket.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(host.querySelector('.voyage-ticket-name strong')?.textContent).toBe('旅伴');
        expect(host.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('custom');
        expect(host.querySelector('textarea')?.value).toBe('第二位的手写资料');
        expect(host.querySelector('pre')?.textContent).toBe('【自定义提示词】\n第二位的手写资料');
        expect(host.textContent).not.toContain('·');
        await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="返回"]')!.click());
        expect(host.querySelector('h1')?.textContent).toBe('旅迹');
    } finally {
        await act(async () => root.unmount());
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    }
});

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
