import { trackEvent } from './analytics';

// One event per feature per editor opening, never per render, slider tick or message.
export function createCameraAnalytics() {
    const seen = new Set<string>();
    return (action: string) => {
        let feature: string;
        switch (action) {
            case 'camera': feature = '拍照'; break;
            case 'gallery': feature = '系统相册'; break;
            case 'stickers': feature = '角色贴纸'; break;
            case 'upload': feature = '上传贴纸'; break;
            case 'live2d': feature = 'Live2D贴纸'; break;
            case 'decoration': feature = '内置贴纸'; break;
            case 'frames': feature = '相框'; break;
            case 'filters': feature = '滤镜'; break;
            case 'ccd': feature = 'CCD滤镜'; break;
            case 'lighting': feature = '匹配环境光'; break;
            default: return;
        }
        if (seen.has(feature)) return;
        seen.add(feature);
        trackEvent('使用聊天相机功能', { 功能: feature });
    };
}
