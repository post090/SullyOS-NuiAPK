import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';
import { createCameraAnalytics } from './cameraAnalytics';

vi.mock('./analytics', () => ({ trackEvent: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('camera analytics privacy', () => {
    it('reports fixed categories once per editor, never arbitrary input', () => {
        const track = createCameraAnalytics();
        for (const key of ['camera', 'gallery', 'stickers', 'upload', 'live2d', 'decoration', 'frames', 'filters', 'ccd', 'lighting']) {
            track(key); track(key);
        }
        track('https://private.example/photo.png');
        track('角色秘密备注');
        expect(vi.mocked(trackEvent).mock.calls).toEqual(
            ['拍照', '系统相册', '角色贴纸', '上传贴纸', 'Live2D贴纸', '内置贴纸', '相框', '滤镜', 'CCD滤镜', '匹配环境光']
                .map(功能 => ['使用聊天相机功能', { 功能 }]),
        );
        createCameraAnalytics()('camera');
        expect(trackEvent).toHaveBeenCalledTimes(11);
    });
});
