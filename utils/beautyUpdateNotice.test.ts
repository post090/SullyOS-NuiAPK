// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BeautyUpdateNotice, { BEAUTY_AUTHOR_NOTICE, BEAUTY_CATALOG_NOTICE, needsBeautyNotice } from '../components/share/BeautyUpdateNotice';

it('用户与作者分别确认一次，说明不会自动公开旧作品，关闭后不再提示', async () => {
  localStorage.clear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), close = vi.fn();
  try {
    expect(needsBeautyNotice(BEAUTY_CATALOG_NOTICE)).toBe(true);
    await act(async () => root.render(React.createElement(BeautyUpdateNotice, { onClose: close })));
    expect(document.querySelector('dialog')?.textContent).toContain('按需体验交互预览');
    await act(async () => (document.querySelector('dialog button') as HTMLButtonElement).click());
    expect(needsBeautyNotice(BEAUTY_CATALOG_NOTICE)).toBe(false);
    expect(needsBeautyNotice(BEAUTY_AUTHOR_NOTICE)).toBe(true);
    await act(async () => root.render(React.createElement(BeautyUpdateNotice, { author: true, onClose: close })));
    expect(document.querySelector('dialog')?.textContent).toContain('原有作品不会自动公开');
    expect(document.querySelector('dialog')?.textContent).toContain('批量修改协议');
    await act(async () => document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(needsBeautyNotice(BEAUTY_AUTHOR_NOTICE)).toBe(false);
    expect(close).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
