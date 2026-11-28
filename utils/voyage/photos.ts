export interface VoyagePhoto {
    imageUrl: string;
    sourceUrl: string;
    caption: string;
    credit: string;
    license: string;
    licenseUrl: string;
}

export interface StopPhotos { photos: VoyagePhoto[]; unavailableReason?: string }

const photoFields = {
    imageUrl: [2048, '已打开验证的 HTTPS 照片直链，优先手机版尺寸'],
    sourceUrl: [2048, '能核对这张作品和作者的原始作品页'],
    caption: [320, '照片实际描绘的地点和细节，必要时注明拍摄季节'],
    credit: [240, '作品页要求保留的摄影者姓名或署名'],
    license: [120, '允许此次展示和分享的许可名称及版本，或公有领域依据'],
    licenseUrl: [2048, '对应许可或公有领域依据的公开页面'],
} as const;
type PhotoField = keyof typeof photoFields;
const photoKeys = Object.keys(photoFields) as PhotoField[];

export const stopPhotosSchema = {
    type: 'object', additionalProperties: false, required: ['photos'],
    properties: {
        photos: { type: 'array', maxItems: 3, description: '本站一至三张有明确许可的真实环境参考照。确实找不到才留空，并填写 unavailableReason。',
            items: { type: 'object', additionalProperties: false, required: photoKeys,
                properties: Object.fromEntries(photoKeys.map(key => [key, { type: 'string', minLength: 1,
                    maxLength: photoFields[key][0], description: photoFields[key][1] }])) } },
        unavailableReason: { type: 'string', minLength: 1, maxLength: 320, description: '仅在无图时填写，说明在哪些来源没有找到可用的本站实景照。' },
    },
};

function text(value: unknown, limit: number, label: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('请补全或缩短' + label);
    return value.trim();
}

function publicLink(value: unknown, key: 'imageUrl' | 'sourceUrl' | 'licenseUrl'): string {
    const raw = text(value, photoFields[key][0], photoFields[key][1]);
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error('照片链接无效'); }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || host.includes(':')
        || /^\d+\.\d+\.\d+\.\d+$/.test(host) || /\.(?:local|localhost|internal|lan|home|test|invalid)$/.test(host))
        throw new Error('照片、作品页和许可须使用公开 HTTPS 链接');
    return url.href;
}

export function readStopPhotos(value: unknown): StopPhotos {
    if (!value || typeof value !== 'object' || !('photos' in value) || !Array.isArray(value.photos) || value.photos.length > 3)
        throw new Error('请提交本站的实景参考照，最多三张');
    const reason = 'unavailableReason' in value ? value.unavailableReason : undefined;
    if (!value.photos.length) return { photos: [], unavailableReason: text(reason, 320, '本站缺少可用照片的原因') };
    if (reason !== undefined) throw new Error('已有照片的站点无需缺图说明');
    const photos = value.photos.map((item: unknown): VoyagePhoto => {
        if (!item || typeof item !== 'object') throw new Error('照片资料无效');
        const p = item as Record<string, unknown>;
        const imageUrl = publicLink(p.imageUrl, 'imageUrl'), sourceUrl = publicLink(p.sourceUrl, 'sourceUrl');
        if (imageUrl === sourceUrl) throw new Error('请分别提供照片直链和原始作品页');
        return { imageUrl, sourceUrl, caption: text(p.caption, 320, '照片说明'), credit: text(p.credit, 240, '作品署名'),
            license: text(p.license, 120, '照片许可'), licenseUrl: publicLink(p.licenseUrl, 'licenseUrl') };
    });
    if (new Set(photos.map(p => p.imageUrl)).size !== photos.length)
        throw new Error('同一站的参考照重复');
    return { photos };
}
