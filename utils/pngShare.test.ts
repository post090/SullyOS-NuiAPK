import { readFileSync } from 'node:fs';
import { File } from 'node:buffer';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { embedShareInPng, extractShareFromPng, MAX_SHARE_BYTES, readShareFile, readShareText, SHARE_KINDS, type ShareCardMetadata, type ShareKind } from './pngShare';

const png = new Uint8Array(readFileSync(new URL('../public/icons/icon-192.png', import.meta.url)));
const encoder = new TextEncoder();
const metadata = (kind: ShareKind = 'character'): ShareCardMetadata => ({
    format: 'sullyos-share', version: 1, kind, title: '雨夜 · Rain 🌙', author: '小作者',
    restrictions: '仅限自用 · 禁止商用\n转载请署名', style: 'paper', fileName: '雨夜.json', mimeType: 'application/json',
});
const file = (bytes: Uint8Array, name = '分享.png', type = 'image/png') => new File([new Uint8Array(bytes).buffer], name, { type }) as unknown as globalThis.File;

describe('PNG portable sharing', () => {
    it.each(Object.keys(SHARE_KINDS) as ShareKind[])('round-trips %s with Unicode, metadata and exact original bytes', kind => {
        const body = encoder.encode(JSON.stringify({ text: '中文 🌙', css: '.x::after { content: "你好"; }', sound: '\u0000' }));
        const result = extractShareFromPng(embedShareInPng(png, metadata(kind), body), kind);
        expect(result.metadata).toEqual(metadata(kind));
        expect(result.payload).toEqual(body);
    });
    it('keeps all image bytes intact and replaces an earlier share payload', () => {
        const first = embedShareInPng(png, metadata(), encoder.encode('old private contents'));
        const updated = embedShareInPng(first, { ...metadata(), title: '新版' }, encoder.encode('new'));
        expect(extractShareFromPng(updated).payload).toEqual(encoder.encode('new'));
        expect(new TextDecoder().decode(updated)).not.toContain('old private contents');
        // All original bytes before IEND remain byte-for-byte identical.
        expect(updated.subarray(0, png.length - 12)).toEqual(png.subarray(0, png.length - 12));
        expect(updated.subarray(updated.length - 12)).toEqual(png.subarray(png.length - 12));
    });
    it('restores a binary ZIP with the original filename and type for the appearance importer', async () => {
        const zip = new JSZip();
        zip.file('manifest.json', '{"name":"星空"}'); zip.file('assets/wallpaper.png', png);
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        const info = { ...metadata('appearance'), fileName: '星空.zip', mimeType: 'application/zip' };
        const restored = await readShareFile(file(embedShareInPng(png, info, bytes)), 'appearance');
        expect(restored.name).toBe('星空.zip'); expect(restored.type).toBe('application/zip');
        const contents = await JSZip.loadAsync(await restored.arrayBuffer());
        expect(await contents.file('manifest.json')!.async('string')).toBe('{"name":"星空"}');
        expect(await contents.file('assets/wallpaper.png')!.async('uint8array')).toEqual(png);
    });
    it('preserves old JSON/CSS/text and ZIP files without conversion', async () => {
        const source = file(encoder.encode('/* 中文 CSS */'), '旧样式.css', 'text/css');
        expect(await readShareFile(source, 'chrome-css')).toBe(source);
        expect(await readShareText(source, 'chrome-css')).toBe('/* 中文 CSS */');
    });
    it('detects PNG by signature even when the filename or MIME changed', async () => {
        const source = file(embedShareInPng(png, metadata(), encoder.encode('角色内容')), 'download.bin', 'application/octet-stream');
        expect(await readShareText(source, 'character')).toBe('角色内容');
    });
    it('rejects a different resource kind before passing anything to a domain importer', async () => {
        const source = file(embedShareInPng(png, metadata('character'), encoder.encode('{}')));
        await expect(readShareFile(source, 'chrome-css')).rejects.toThrow('这是一张角色卡分享图');
    });
    it('explains plain images and renamed JPEGs instead of parsing them as content', async () => {
        expect(() => extractShareFromPng(png)).toThrow('没有可导入');
        await expect(readShareFile(file(encoder.encode('not png')), 'character')).rejects.toThrow('PNG 原文件');
    });
    it('rejects corrupted payloads, truncated data and impossible lengths', () => {
        const shared = embedShareInPng(png, metadata(), encoder.encode('actual character content'));
        const damaged = shared.slice(); damaged[damaged.length - 18] ^= 1;
        expect(() => extractShareFromPng(damaged)).toThrow('校验失败');
        expect(() => extractShareFromPng(shared.slice(0, -8))).toThrow('不完整');
        const badLength = shared.slice(); new DataView(badLength.buffer).setUint32(png.length - 12, 0xffffffff);
        expect(() => extractShareFromPng(badLength)).toThrow('长度异常');
    });
    it('rejects duplicate payload chunks and trailing data', () => {
        const shared = embedShareInPng(png, metadata(), encoder.encode('content'));
        const start = png.length - 12, end = shared.length - 12;
        const duplicate = new Uint8Array(shared.length + end - start);
        duplicate.set(shared.subarray(0, end)); duplicate.set(shared.subarray(start, end), end);
        duplicate.set(shared.subarray(end), duplicate.length - 12);
        expect(() => extractShareFromPng(duplicate)).toThrow('重复数据');
        const trailing = new Uint8Array(shared.length + 1); trailing.set(shared);
        expect(() => extractShareFromPng(trailing)).toThrow('结构异常');
    });
    it('refuses oversized, empty or unsupported exports and unsafe embedded names', () => {
        expect(() => embedShareInPng(png, metadata(), new Uint8Array())).toThrow('为空');
        expect(() => embedShareInPng(png, metadata(), new Uint8Array(MAX_SHARE_BYTES + 1))).toThrow('64 MB');
        expect(() => embedShareInPng(png, { ...metadata(), version: 2 } as unknown as ShareCardMetadata, encoder.encode('x'))).toThrow('更新');
        expect(() => embedShareInPng(png, { ...metadata(), fileName: '../bad.json' }, encoder.encode('x'))).toThrow('信息无效');
    });
});
