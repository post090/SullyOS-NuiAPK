// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BeautySharePanel from '../components/share/BeautySharePanel';
import { beautyRequest, downloadBeauty } from './beautyShareClient';
vi.mock('./beautyShareClient', () => ({ beautyRequest: vi.fn(), downloadBeauty: vi.fn(), readBeautySession: () => null, saveBeautySession: vi.fn(), normalizeBeautyPackage: vi.fn(), readBeautyPackage: vi.fn() }));
vi.mock('./exportGuard', () => ({ confirmExportSafety: vi.fn() }));
vi.mock('./shareExport', () => ({ shareOrDownloadFile: vi.fn() }));
vi.mock('../components/share/BeautyPresetPicker', () => ({ default: () => null }));
vi.mock('../components/share/BeautyPresetPreview', () => ({ default: () => null }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it.each(['appearance', 'chat-decoration'] as const)('receives %s by the code type, irrespective of the starting category', async kind => {
  vi.clearAllMocks();
  const host = document.createElement('div'); const root = createRoot(host);
  const share = { code: 'S-0123456789AB', kind, metadata: { name: '测试', credit: '作者', platforms: ['糯米机美化群'], exportVersion: 'test', bugFeedback: 'welcome' } };
  vi.mocked(beautyRequest).mockResolvedValue(share);
  const pack = { test: kind }; vi.mocked(downloadBeauty).mockResolvedValue(pack as any);
  const receive = vi.fn(async () => {});
  try {
    await act(async () => root.render(React.createElement(BeautySharePanel, { kind: kind === 'appearance' ? 'chat-decoration' : 'appearance', surface: 'receive', unified: true, defaultOpen: true, sources: [], onReceive: receive })));
    expect(host.querySelector('nav')).toBeNull();
    expect(host.textContent).not.toContain('我的提交');
    const input = host.querySelector('input')!;
    await act(async () => Simulate.change(input, { target: { value: share.code } } as any));
    const click = async (label: string) => act(async () => { Array.from(host.querySelectorAll('button')).find(b => b.textContent === label)!.click(); });
    await click('查看说明');
    expect(host.querySelector('[role=alert]')).toBeNull();
    await act(async () => Simulate.change(host.querySelector('input[type=checkbox]')!, { target: { checked: true } } as any));
    await click('领取并载入预设');
    expect(downloadBeauty).toHaveBeenCalledWith(share, kind);
    expect(receive).toHaveBeenCalledWith(pack, share);
  } finally { await act(async () => root.unmount()); }
});
