// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { ChatLocationPin } from '../components/chat/ChatLocationPin';
import { renderChatDecorationSample } from '../components/chat/ChatDecorationSample';
import pinCss from '../components/chat/chatLocationPin.css?raw';
import { PRESET_THEMES } from '../components/chat/ChatConstants';
import MessageItem from '../components/chat/MessageItem';
import { getCurrentPositionSmart } from './geo';
import { handleLocalBack } from './localBackHandlers';
import { clearLocationPin, getUserLocationContext, saveUserLocationConfig } from './userLocation';

vi.mock('./geo', async original => ({ ...await original<typeof import('./geo')>(), getCurrentPositionSmart: vi.fn() }));
const charId = 'pin-test';
const privatePlace = '示例图书馆';
const fix = { latitude: 30, longitude: 120, accuracy: 5 };
const needsDialogMethods = !HTMLDialogElement.prototype.showModal;
let host: HTMLElement, root: Root;
beforeAll(() => {
    if (needsDialogMethods) Object.assign(HTMLDialogElement.prototype, {
        showModal(this: HTMLDialogElement) { this.open = true; },
        close(this: HTMLDialogElement) { this.open = false; },
    });
});
afterAll(() => {
    if (needsDialogMethods) {
        Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
        Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    }
});
beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
    saveUserLocationConfig({ enabled: true, regions: [{ id: 'library', name: privatePlace, ...fix, radiusKm: 1 }] });
    vi.mocked(getCurrentPositionSmart).mockReset().mockResolvedValue(fix);
    host = document.createElement('main');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    clearLocationPin(charId);
    host.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
});

function renderMessage(selectionMode = false) {
    act(() => root.render(React.createElement(MessageItem, {
        msg: {id: 1, charId, role: 'user', type: 'text', content: '嗯', timestamp: 1},
        isFirstInGroup: true, isLastInGroup: true, activeTheme: PRESET_THEMES.default,
        charAvatar: '', charName: '角色', userAvatar: '', selectionMode, isSelected: false,
        onLongPress: vi.fn(), onReply: vi.fn(), onToggleSelect: vi.fn(),
        showTimestamp: 'always', timestampPosition: 'below', sendPhase: 'sending',
        locationPin: React.createElement(ChatLocationPin, {charId}),
    })));
}
const badge = () => host.querySelector<HTMLButtonElement>('.sully-chat-location-pin');

it('keeps the live status with the bubble, independent of the avatar, timestamp, sending and selection', async () => {
    renderMessage();
    expect(badge()).toBeNull();
    let finish!: (value: typeof fix) => void;
    vi.mocked(getCurrentPositionSmart).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let request!: Promise<string>;
    act(() => { request = getUserLocationContext('我', charId, true); });
    expect(badge()?.textContent).toBe('正在定位');
    await act(async () => { finish(fix); await request; });
    const chip = badge()!;
    expect(chip.textContent).toBe('已获取位置');
    expect(chip.parentElement).toBe(host.querySelector('.sully-chat-message-content'));
    expect(chip.closest('.sully-chat-message-avatar-slot, .sully-chat-timestamp-slot')).toBeNull();
    expect(host.querySelector('.sully-chat-send-progress')).not.toBeNull();
    expect(host.querySelector('.sully-chat-timestamp')).not.toBeNull();
    expect(host.textContent).not.toContain(privatePlace);
    expect(getCurrentPositionSmart).toHaveBeenCalledTimes(1);
    renderMessage(true);
    expect(badge()).toBeNull();
});

it('reveals only the private alias in details, preserves manual refresh and handles Android back and hiding', async () => {
    renderMessage();
    await act(async () => { await getUserLocationContext('我', charId, true); });
    act(() => badge()!.click());
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(dialog.textContent).toContain(privatePlace + '附近');
    const refresh = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === '重新获取定位')!;
    await act(async () => refresh.click());
    expect(dialog.textContent).toContain('下轮回复将使用这次位置');
    act(() => { expect(handleLocalBack()).toBe(true); });
    expect(document.querySelector('dialog')).toBeNull();
    act(() => badge()!.click());
    act(() => document.querySelector<HTMLInputElement>('dialog input')!.click());
    expect(badge()).toBeNull();
    act(() => { expect(handleLocalBack()).toBe(true); });
    expect(await getUserLocationContext('我', charId)).toContain(privatePlace);
});

it('previews the monochrome pin with an eight-pixel gap even when a skin hides user avatars', () => {
    const skin = '.sully-chat-message-user .sully-chat-message-avatar-slot { display: none }';
    const preview = renderChatDecorationSample({
        format: 'sullyos-chat-decoration', version: 1, name: '示例',
        parts: { css: skin },
    }, 'conversation');
    expect(pinCss).toContain('.sully-chat-location-pin');
    expect(preview.css).toContain(pinCss);
    const style = document.createElement('style');
    style.textContent = pinCss + skin;
    host.innerHTML = preview.markup;
    host.prepend(style);
    const chip = badge()!;
    const avatar = chip.closest('.sully-chat-message')!.querySelector('.sully-chat-message-avatar-slot')!;
    expect(getComputedStyle(avatar).display).toBe('none');
    expect(avatar.contains(chip)).toBe(false);
    const appearance = getComputedStyle(chip);
    expect(appearance.marginTop).toBe('8px');
    expect(appearance.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(appearance.color).toBe('rgb(36, 36, 36)');
    expect(chip.textContent).toBe('已获取位置');
    expect(getCurrentPositionSmart).not.toHaveBeenCalled();
});
