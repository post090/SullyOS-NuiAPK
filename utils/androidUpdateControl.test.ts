// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  isAndroidAppUpdateEnabled: () => true,
  getInstalledAndroidAppInfo: vi.fn().mockResolvedValue({ versionCode: 30503 }),
  fetchAndroidUpdateManifest: vi.fn().mockResolvedValue({ versionCode: 30504, versionName: '3.5.4', releaseNotes: [] }),
  downloadAndVerifyAndroidUpdate: vi.fn(),
  installVerifiedAndroidUpdate: vi.fn().mockResolvedValue({ status: 'permission_required' }),
}));
vi.mock('./androidAppUpdate', () => api);
vi.mock('./analytics', () => ({ trackEvent: vi.fn() }));
import AndroidUpdateControl from '../components/settings/AndroidUpdateControl';

it('remounts mid-download with the same progress and resumes install without downloading again', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let resolve!: (path: string) => void;
  api.downloadAndVerifyAndroidUpdate.mockReturnValue(new Promise<string>(yes => { resolve = yes; }));
  const container = document.createElement('div');
  document.body.append(container);
  let root = createRoot(container);
  const button = () => container.querySelector('button')!;
  try {
    await act(async () => { root.render(React.createElement(AndroidUpdateControl)); });
    await act(async () => { button().click(); });
    expect(button().textContent).toBe('下载并安装 3.5.4');
    await act(async () => { button().click(); });
    const progress = api.downloadAndVerifyAndroidUpdate.mock.calls[0][1];
    act(() => { progress(0.4); root.unmount(); });
    progress(0.65);
    root = createRoot(container);
    await act(async () => { root.render(React.createElement(AndroidUpdateControl)); });
    expect(button().textContent).toBe('下载中 65%');
    expect(button().disabled).toBe(true);
    await act(async () => { button().click(); });
    expect(api.downloadAndVerifyAndroidUpdate).toHaveBeenCalledTimes(1);
    await act(async () => { resolve('file:///verified.apk'); });
    expect(button().textContent).toBe('继续安装');
    act(() => { root.unmount(); });
    root = createRoot(container);
    await act(async () => { root.render(React.createElement(AndroidUpdateControl)); });
    api.installVerifiedAndroidUpdate.mockResolvedValue({ status: 'installer_opened' });
    await act(async () => { button().click(); });
    expect(button().textContent).toBe('再次打开安装器');
    expect(button().disabled).toBe(false);
    expect(api.downloadAndVerifyAndroidUpdate).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
