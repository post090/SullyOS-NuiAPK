// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { DB } from './db';
import { dataUrlToBlob } from './blobRef';

it('preserves Blob bytes through the fake IndexedDB shared asset pool', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,AQID');
    await DB.putBlobAsset('b_environment_roundtrip', blob);
    const restored = await DB.getBlobAsset('b_environment_roundtrip');
    expect(restored).not.toBeNull();
    expect(restored!.type).toBe('image/png');
    expect(new Uint8Array(await restored!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

it('reads stored binary files through FileReader without losing MIME or bytes', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });
    const reader = new FileReader();
    const result = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
    });
    reader.readAsDataURL(file);
    expect(await result).toBe('data:image/png;base64,AQID');
    expect(reader.readyState).toBe(FileReader.DONE);
});
