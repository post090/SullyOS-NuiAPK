// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    toast: vi.fn(), updateCharacter: vi.fn(), fetch: vi.fn(), registerBackHandler: vi.fn(() => () => {}),
    session: null as any, rows: [] as any[],
    characters: [{ id: 'c', name: '测试角色', avatar: '', savedDateState: { currentText: '旧快照' } }],
}));
vi.mock('../context/OSContext', async () => {
    const React = await import('react');
    return { useOS: () => {
        const [activeCharacterId, setActiveCharacterId] = React.useState('c');
        return {
            activeCharacterId, setActiveCharacterId,
            characters: mocks.characters,
            closeApp: vi.fn(), openApp: vi.fn(), addToast: mocks.toast, updateCharacter: mocks.updateCharacter,
            updateUserProfile: vi.fn(), userProfile: { name: '用户' }, groups: [], characterGroups: [],
            virtualTime: { hours: 12, minutes: 0, day: 'Thu' }, apiConfig: { baseUrl: 'https://example.invalid' }, consumeDateAutoStart: vi.fn(),
            registerBackHandler: mocks.registerBackHandler,
        };
    } };
});
vi.mock('../components/date/DateSession', () => ({ default: (props: any) => {
    mocks.session = props;
    return React.createElement('button', { onClick: props.onExit }, '退出见面');
} }));
vi.mock('../components/date/DateSettings', () => ({ default: () => null }));
vi.mock('../components/date/story/StoryTheater', () => ({ default: () => null }));
vi.mock('./analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('./amsgStateSync', () => ({ markAmsgStateDirty: vi.fn() }));
vi.mock('./chatContextRange', async importOriginal => ({
    ...await importOriginal<typeof import('./chatContextRange')>(),
    loadCharacterContextMessages: vi.fn(async () => []),
}));
vi.mock('./visionApi', () => ({ materializeVisionDescriptions: vi.fn(async messages => messages) }));
vi.mock('./safeApi', () => ({ safeResponseJson: vi.fn(async () => ({})), extractContent: vi.fn(() => '测试开场正文') }));
vi.mock('./db', () => ({ DB: {
    getAsset: vi.fn(async () => undefined),
    getRecentMessagesByCharIdAndSource: vi.fn(async () => mocks.rows),
    getEmojis: vi.fn(async () => []),
    saveMessage: vi.fn(async message => { mocks.rows.push({ ...message, id: mocks.rows.length + 1, timestamp: 1 }); return mocks.rows.length; }),
} }));
import DateApp from '../apps/DateApp';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sully-date-entry-guide-v1', 'seen');
    mocks.rows = [];
    mocks.session = null;
    mocks.fetch.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mocks.fetch);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

it.each(['靠近他', '让他靠近'])('%s 生成对应开场并保存场次和开场方式', async label => {
    await act(async () => root.render(React.createElement(DateApp)));
    await clickText('测试角色');
    await clickText(label);
    expect(mocks.fetch, JSON.stringify(mocks.toast.mock.calls)).toHaveBeenCalledTimes(1);
    const request = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(JSON.stringify(request.messages)).toContain(label === '靠近他' ? '用户正在悄悄靠近' : '由你主动以合理的方式');
    await clickText(label === '靠近他' ? '走过去' : '见到他');
    expect(mocks.rows).toHaveLength(1);
    expect(mocks.rows[0].metadata).toMatchObject({
        isOpening: true, dateEncounterId: mocks.session.encounterId,
        dateOpeningMode: label === '靠近他' ? 'approach' : 'invite',
    });
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
const clickText = async (text: string) => {
    const element = Array.from(container.querySelectorAll('button, span')).find(el => el.textContent === text);
    expect(element, text).toBeTruthy();
    await act(async () => { element!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

it('首次到达三个选项才展示说明，确认后重新打开也不再提示', async () => {
    localStorage.removeItem('sully-date-entry-guide-v1');
    await act(async () => root.render(React.createElement(DateApp)));
    expect(container.textContent).not.toContain('选择这次见面的开场方式');
    await clickText('测试角色');
    expect(container.textContent).toContain('选择这次见面的开场方式');
    expect(container.textContent).toContain('你主动走过去');
    expect(container.textContent).toContain('他主动来见你');
    expect(container.textContent).toContain('直接见面 · 不生成开场白');
    await clickText('知道了');
    expect(localStorage.getItem('sully-date-entry-guide-v1')).toBe('seen');
    expect(container.textContent).not.toContain('选择这次见面的开场方式');
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(React.createElement(DateApp)));
    await clickText('测试角色');
    expect(container.textContent).not.toContain('选择这次见面的开场方式');
    expect(mocks.fetch).not.toHaveBeenCalled();
});

it('有旧快照仍显示三个入口；直接见面不请求开场，退出无弹窗，再进入是独立场次', async () => {
    await act(async () => root.render(React.createElement(DateApp)));
    await clickText('测试角色');
    expect(container.textContent).toContain('靠近他');
    expect(container.textContent).toContain('让他靠近');
    expect(container.textContent).toContain('直接见面');
    expect(container.textContent).not.toContain('继续上次');
    await clickText('直接见面');
    const firstId = mocks.session.encounterId;
    expect(firstId).toBeTruthy();
    expect(mocks.session.peekStatus).toBe('');
    expect(mocks.session.initialState).toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
    await clickText('退出见面');
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('保存并退出');
    mocks.rows = [{ id: 1, role: 'assistant', content: '上一场', timestamp: 1,
        metadata: { source: 'date', dateEncounterId: firstId } }];
    await clickText('测试角色');
    await clickText('直接见面');
    expect(mocks.session.encounterId).not.toBe(firstId);
    expect(mocks.session.messages.map((message: any) => message.content)).toEqual(['上一场']);
});
