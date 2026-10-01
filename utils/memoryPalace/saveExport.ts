import { shareOrDownloadBlob } from '../shareExport';

/** Same delivery path as Settings' full backup: native cache → system share sheet. */
export async function saveMemoryPalaceExport(content: string, fileName: string, shareTitle: string) {
    return { kind: await shareOrDownloadBlob({
        blob: new Blob([content], { type: 'application/json' }), fileName, shareTitle, nativeChunked: true,
    }) };
}
