import type { VisionApiConfig } from '../types';
import { normalizeVisionImageQuality } from './apiConfigNormalize';
import { processImageToBlob } from './file';

/** Uploads and camera output share this policy before message/gallery storage. */
export function prepareChatImage(file: File, config?: Pick<VisionApiConfig, 'imageQuality'>): Promise<Blob> {
    // Preserve animation and the existing GIF size check in every quality mode.
    if (file.type === 'image/gif') return processImageToBlob(file);
    switch (normalizeVisionImageQuality(config?.imageQuality)) {
        case 'high':
            return processImageToBlob(file, { maxWidth: 1600, quality: 0.9, forceJpeg: true });
        case 'compressed':
            return processImageToBlob(file, { maxWidth: 600, quality: 0.6, forceJpeg: true });
        default:
            return processImageToBlob(file, { skipCompression: true });
    }
}
