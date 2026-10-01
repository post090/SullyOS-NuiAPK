// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { File } from 'node:buffer';
import JSZip from 'jszip';
import { BEAUTY_MAX_BYTES, validateBeautyMetadata, validateBeautyPackage } from './beautyShareContract';
import { readBeautyPackage, normalizeBeautyPackage } from './beautyShareClient';

const metadata = { name: '月光', credit: '作者', platforms: ['糯米机美化群'], contact: '', allowRemix: false, allowRedistribute: true, exportVersion: 'v3.10', bugFeedback: 'welcome', message: '' };
const pack = { type: 'sully_appearance_preset', version: 1, name: '月光', theme: { primaryColor: '#fff' } };
const file = (content: BlobPart, name: string) => new File([content as any], name) as unknown as globalThis.File;
describe('美化分享格式边界', () => {
  it('accepts a reviewed chat package with the new psyche appearance part',()=>{
    const pack={format:'sullyos-chat-decoration',version:1,name:'心象',parts:{psyche:{styleId:'ink',customCss:''}}};
    expect(validateBeautyPackage(pack)).toEqual({kind:'chat-decoration',data:pack});
  });
  it('要求平台、署名、权限与反馈偏好明确', () => {
    expect(validateBeautyMetadata(metadata).allowRedistribute).toBe(true);
    for (const patch of [{ platforms: [] }, { credit: '' }, { allowRemix: 'yes' }, { bugFeedback: 'unknown' }]) expect(() => validateBeautyMetadata({ ...metadata, ...patch })).toThrow();
  });
  it('不接收整机备份，去掉美化包顶层的额外字段', () => {
    expect(() => validateBeautyPackage({ name: '备份', characters: [], config: {} })).toThrow();
    expect(validateBeautyPackage({ ...pack, apiKey: 'not-for-sharing', characters: [] }).data).toEqual(pack);
    expect(() => normalizeBeautyPackage(pack, 'chat-decoration')).toThrow();
  });
  it('读取现有外观 ZIP 导出格式', async () => {
    const zip = new JSZip(); zip.file('preset.json', JSON.stringify(pack));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    expect(await readBeautyPackage(file(new Uint8Array(bytes).buffer, 'preset.zip'), 'appearance')).toEqual(pack);
  });
  it('解压实际输出有上限，不能用高压缩比绕过', async () => {
    const zip = new JSZip(); zip.file('preset.json', JSON.stringify({ ...pack, padding: 'a'.repeat(BEAUTY_MAX_BYTES) }));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    expect(bytes.byteLength).toBeLessThan(100_000);
    await expect(readBeautyPackage(file(new Uint8Array(bytes).buffer, 'large.zip'), 'appearance')).rejects.toThrow('20 MB');
  });
  it('聊天美化在接收端仍走原有严格验证器', () => {
    expect(() => normalizeBeautyPackage({ format: 'sullyos-chat-decoration', version: 1, name: '错误背景', parts: { background: { image: 'javascript:bad', style: 'plain' } } }, 'chat-decoration')).toThrow();
  });
});
