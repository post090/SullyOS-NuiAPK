// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareChatImage } from './chatImageQuality';
import { getBlobForRef, putImageBlobDeduped } from './blobRef';
import { resolveBlobRefsInRequestBody } from './apiBlobRefs';

const encoded = new Blob(['encoded JPEG'], { type: 'image/jpeg' });
const encode = vi.fn((callback: BlobCallback) => callback(encoded));
beforeEach(() => {
    encode.mockClear();
    vi.stubGlobal('Image', class {
        width = 4000; height = 3000; onload?: () => void;
        set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal('URL', class extends URL {
        static createObjectURL = vi.fn(() => 'blob:chat-image-input');
        static revokeObjectURL = vi.fn();
    });
    const canvas2D: { getContext(contextId: '2d'): CanvasRenderingContext2D | null } = HTMLCanvasElement.prototype;
    vi.spyOn(canvas2D, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(encode);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('chat image quality', () => {
    it.each(['image/png', 'image/jpeg', 'image/webp'])('keeps original %s bytes and MIME through storage and the API payload by default', async type => {
        const bytes = new TextEncoder().encode(`original ${type} bytes`);
        const file = new File([bytes], 'original-image', { type });
        const result = await prepareChatImage(file);
        expect(result).toBe(file);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(encode).not.toHaveBeenCalled();
        const { token } = await putImageBlobDeduped(result);
        const stored = await getBlobForRef(token);
        expect(stored?.type).toBe(type);
        expect(Array.from(new Uint8Array(await stored!.arrayBuffer()))).toEqual(Array.from(bytes));
        const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: token } }] }] });
        const resolved = await resolveBlobRefsInRequestBody(body);
        expect(resolved).toBe(body.replace(token, `data:${type};base64,${Buffer.from(bytes).toString('base64')}`));
    });

    it.each([
        ['high', 1600, 1200, 0.9],
        ['compressed', 600, 450, 0.6],
    ] as const)('uses the selected %s budget instead of silently keeping the old compression', async (imageQuality, width, height, quality) => {
        expect(await prepareChatImage(new File(['input'], 'photo.png', { type: 'image/png' }), { imageQuality })).toBe(encoded);
        const canvas = encode.mock.contexts[0] as HTMLCanvasElement;
        expect([canvas.width, canvas.height]).toEqual([width, height]);
        expect(encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', quality);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chat-image-input');
    });

    it.each(['original', 'high', 'compressed'] as const)('retains GIF animation bytes in %s mode', async imageQuality => {
        const gif = new File(['GIF89a'], 'animation.gif', { type: 'image/gif' });
        expect(await prepareChatImage(gif, { imageQuality })).toBe(gif);
        expect(encode).not.toHaveBeenCalled();
    });

    it('keeps the GIF size guard and rejects non-image input in original mode', async () => {
        const gif = new File(['GIF89a'], 'huge.gif', { type: 'image/gif' });
        Object.defineProperty(gif, 'size', { value: 51 * 1024 * 1024 });
        await expect(prepareChatImage(gif)).rejects.toThrow('GIF 图片过大');
        await expect(prepareChatImage(new File(['text'], 'note.txt', { type: 'text/plain' }))).rejects.toThrow('请上传图片文件');
    });
});
