import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareOrDownloadBlob, shareOrDownloadFile } from './shareExport';

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
const originalCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare');

afterEach(() => {
  if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
  else Reflect.deleteProperty(navigator, 'share');
  if (originalCanShare) Object.defineProperty(navigator, 'canShare', originalCanShare);
  else Reflect.deleteProperty(navigator, 'canShare');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('web text file sharing', () => {
  it('stops after an AbortError without turning the cancellation into a download', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('分享已取消', 'AbortError'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    expect(await shareOrDownloadFile({ content: 'abc', fileName: 'test.txt' })).toBe('cancelled');
    expect(share).toHaveBeenCalledTimes(1);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('downloads the actual file once when sharing files is unsupported', async () => {
    const share = vi.fn();
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
    expect(await shareOrDownloadFile({ content: '原文\n第二行', fileName: '对话.txt' })).toBe('downloaded');
    const exported = createObjectURL.mock.calls[0][0];
    if (!(exported instanceof Blob)) throw new Error('Expected a downloadable file');
    expect(await exported.text()).toBe('原文\n第二行');
    expect(link.download).toBe('对话.txt');
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
  });
});

describe('shareOrDownloadBlob web file sharing', () => {
  it('hands the real file to Web Share before considering a browser download', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });

    const result = await shareOrDownloadBlob({
      blob: new Blob(['real file'], { type: 'application/pdf' }),
      fileName: '协同交付.pdf',
      shareTitle: '协同交付',
    });

    expect(result).toBe('shared');
    expect(canShare).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as ShareData;
    expect(payload.title).toBe('协同交付');
    expect(payload.files?.[0]?.name).toBe('协同交付.pdf');
    expect(payload.files?.[0]?.size).toBe(9);
  });
});
