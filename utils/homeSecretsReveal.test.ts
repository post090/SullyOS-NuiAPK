// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import HomeSecretsReveal from '../apps/room3d/HomeSecretsReveal';
const mocks = vi.hoisted(() => ({read: vi.fn(), seen: vi.fn()}));
vi.mock('./homeSecrets', () => ({readHomeSecrets: mocks.read, markHomeSecretsSeen: mocks.seen}));
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
const rows = () => [1, 2, 3].map(id => ({id: String(id), text: `秘密${id}`, seen: false}));
const render = (active = true, ready = true, charId = 'c') => act(async () => root.render(React.createElement(HomeSecretsReveal, {charId, active, ready})));
const click = () => act(async () => host.querySelector('button')!.click());
beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    mocks.read.mockResolvedValue(rows()); mocks.seen.mockResolvedValue(undefined);
});
afterEach(() => {act(() => root.unmount()); host.remove(); vi.resetAllMocks(); vi.unstubAllGlobals();});

it('opens an envelope, acknowledges only the viewed paper, and waits for re-entry for new secrets', async () => {
    let current = rows();
    mocks.read.mockImplementation(async () => current);
    mocks.seen.mockImplementation(async (_charId, ids) => {current = current.map(row => ({...row, seen: row.seen || ids.includes(row.id)}));});
    await render();
    expect(host.textContent).toContain('一些秘密……');
    expect(host.textContent).toContain('拆开纸条');
    expect(host.textContent).not.toContain('秘密1');
    await click();
    expect(host.textContent).toContain('秘密1');
    expect(host.textContent).not.toContain('秘密2');
    expect(mocks.seen).not.toHaveBeenCalled();
    await click();
    expect(mocks.seen).toHaveBeenLastCalledWith('c', ['1']);
    expect(host.textContent).toContain('秘密2');
    expect(host.textContent).not.toContain('秘密3');
    await click();
    expect(mocks.seen).toHaveBeenLastCalledWith('c', ['2']);
    expect(host.textContent).toBe('');
    current.push({id: '4', text: '秘密4', seen: false});
    await render(); expect(host.textContent).toBe('');
    await render(false); await render(); await click();
    expect(host.textContent).toContain('秘密3');
    await click(); expect(host.textContent).toContain('秘密4');
});

it('ignores backdrop taps and native cancel/back actions without consuming a paper', async () => {
    await render();
    const dialog = host.querySelector('dialog')!;
    await act(async () => dialog.click());
    const cancel = new Event('cancel', {bubbles: false, cancelable: true});
    await act(async () => {dialog.dispatchEvent(cancel);});
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(mocks.seen).not.toHaveBeenCalled();
    await click();
    await act(async () => dialog.click());
    expect(host.textContent).toContain('秘密1');
    expect(mocks.seen).not.toHaveBeenCalled();
});

it('keeps a failed acknowledgement retryable without advancing or marking other papers', async () => {
    mocks.seen.mockRejectedValueOnce(new Error('storage')).mockResolvedValue(undefined);
    await render(); await click(); await click();
    expect(host.textContent).toContain('阅读状态没能保存');
    expect(host.textContent).toContain('秘密1');
    expect(host.textContent).not.toContain('秘密2');
    await click();
    expect(host.textContent).toContain('秘密2');
    expect(mocks.seen.mock.calls).toEqual([['c', ['1']], ['c', ['1']]]);
});

it('waits for the ready gate and leaving while reading preserves unacknowledged papers', async () => {
    await render(true, false); expect(host.querySelector('dialog')).toBeNull();
    await render(); await click();
    await render(false); expect(host.querySelector('dialog')).toBeNull();
    expect(mocks.seen).not.toHaveBeenCalled();
    await render(); await click(); expect(host.textContent).toContain('秘密1');
});

it('late acknowledgements cannot close a new visit or leave it stuck saving', async () => {
    let finish!: () => void;
    mocks.seen.mockImplementationOnce(() => new Promise<void>(resolve => {finish = resolve;}));
    await render(); await click(); await click();
    expect(host.textContent).toContain('正在收好');
    await render(false); await render();
    await act(async () => finish());
    expect(host.textContent).toContain('拆开纸条');
    expect(host.querySelector('button')?.disabled).toBe(false);
    await click(); expect(host.textContent).toContain('秘密1');
});

it('a read failure can be explicitly dismissed, without writing read state', async () => {
    mocks.read.mockRejectedValue(new Error('storage'));
    await render(); expect(host.textContent).toContain('秘密暂时没能读取');
    await click(); expect(host.textContent).toBe('');
    expect(mocks.seen).not.toHaveBeenCalled();
});
