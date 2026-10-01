import { beforeEach, describe, expect, it, vi } from 'vitest';
const share = vi.hoisted(() => vi.fn());
vi.mock('../shareExport', () => ({ shareOrDownloadBlob: share }));
import { saveMemoryPalaceExport } from './saveExport';
beforeEach(() => { share.mockReset(); });
describe('记忆导出复用全部备份分享流程', () => {
    it('发送完整 JSON，并为原生大文件启用分片缓存写入', async () => {
        share.mockResolvedValue('shared');
        expect(await saveMemoryPalaceExport('{"记忆":"中文"}', '记忆.json', '记忆宫殿')).toEqual({ kind: 'shared' });
        const options = share.mock.calls[0][0];
        expect(options).toMatchObject({ fileName: '记忆.json', shareTitle: '记忆宫殿', nativeChunked: true });
        expect(options.blob.type).toBe('application/json');
        expect(await options.blob.text()).toBe('{"记忆":"中文"}');
    });
    it('取消不报成功，分享失败向上报告', async () => {
        share.mockResolvedValue('cancelled');
        expect(await saveMemoryPalaceExport('{}', '记忆.json', '导出')).toEqual({ kind: 'cancelled' });
        share.mockRejectedValue(new Error('分享不可用'));
        await expect(saveMemoryPalaceExport('{}', '记忆.json', '导出')).rejects.toThrow('分享不可用');
    });
});
