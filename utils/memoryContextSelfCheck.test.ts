// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import MemoryContextSelfCheck, { memorySelfCheckKey } from '../components/chat/MemoryContextSelfCheck';
import type { CharacterProfile } from '../types';

describe('memory context self check', () => {
    let host: HTMLDivElement, root: Root;
    const disable = vi.fn();
    const render = (patch: Partial<CharacterProfile> = {}, active = true) => act(() => root.render(React.createElement(MemoryContextSelfCheck, { key: patch.id || 'a', character: { id: 'a', name: '测试角色', memoryPalaceEnabled: true, activeMemoryMonths: ['2026-10', '2025-09'], ...patch } as CharacterProfile, active, onDisable: disable })));
    const click = (label: string) => act(() => { (Array.from(host.querySelectorAll('button')).find(button => button.textContent === label) as HTMLButtonElement).click(); });
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        localStorage.clear(); disable.mockClear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    });
    afterEach(() => { act(() => root.unmount()); host.remove(); });
    it('only prompts active chats with palace and enabled months', () => {
        render({ memoryPalaceEnabled: false }); expect(host.textContent).toBe('');
        render({ activeMemoryMonths: [] }); expect(host.textContent).toBe('');
        render({}, false); expect(host.textContent).toBe('');
        render(); expect(host.textContent).toContain('2025年9月、2026年10月');
    });
    it('yes passes only the displayed months for disabling', () => {
        render(); click('是');
        expect(disable).toHaveBeenCalledWith(['2025-09', '2026-10']);
        expect(localStorage.getItem(memorySelfCheckKey('a'))).toBe('done');
        expect(host.textContent).toBe('');
    });
    it('no preserves the settings and acknowledges once per character', () => {
        render(); click('否'); expect(disable).not.toHaveBeenCalled();
        render({ id: 'b' }); expect(host.textContent).toContain('请自查');
        render({ id: 'a' }); expect(host.textContent).toBe('');
    });
    it('unclear preserves memories and shows community guidance', () => {
        render(); click('我看不懂'); expect(disable).not.toHaveBeenCalled();
        expect(host.textContent).toContain('暂时无需处理，有疑问时欢迎在 DC 社区反馈。');
        click('确定'); expect(host.textContent).toBe('');
    });
});
