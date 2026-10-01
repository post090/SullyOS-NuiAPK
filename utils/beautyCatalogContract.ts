import { isRecord, validateBeautyMetadata, type BeautyShare } from './beautyShareContract';

export interface BeautyCatalogEntry extends BeautyShare { categories: string[]; cover: string; file: string }
export interface BeautyCatalog { version: 1; generatedAt: number; entries: BeautyCatalogEntry[] }
export const CATALOG_COVER_MAX = 256 * 1024;
/** Only raster images; never publish SVG/HTML supplied as a cover. */
export function validateCatalogCover(value: unknown): string {
  if (typeof value !== 'string' || value.length > CATALOG_COVER_MAX * 1.4) throw Error('装扮库封面最多 256 KB');
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw Error('请生成 PNG 或 WebP 装扮库封面');
  let raw: string;
  try { raw = atob(match[2]); } catch { throw Error('封面数据无效'); }
  if (raw.length > CATALOG_COVER_MAX || (match[1] === 'png'
    ? !raw.startsWith('\x89PNG\r\n\x1a\n') : !(raw.startsWith('RIFF') && raw.slice(8,12) === 'WEBP'))) throw Error('封面数据无效');
  return value;
}
export function parseBeautyCatalog(value: unknown): BeautyCatalog {
  if (!isRecord(value) || value.version !== 1 || !Number.isFinite(value.generatedAt) || !Array.isArray(value.entries) || value.entries.length > 10000) throw Error('装扮库目录格式无效');
  const codes = new Set<string>();
  const entries = value.entries.map((item: unknown): BeautyCatalogEntry => {
    if (!isRecord(item) || !/^S-[A-F0-9]{12}$/.test(item.code) || !/^[a-f0-9]{32}$/.test(item.revision) || !/^[a-f0-9]{64}$/.test(item.sha256)
      || !['appearance','chat-decoration'].includes(item.kind) || !Number.isInteger(item.bytes) || item.bytes <= 0 || item.bytes > 20*1024*1024
      || !Array.isArray(item.categories) || item.categories.some((c:unknown) => typeof c !== 'string')) throw Error('装扮库条目无效');
    const metadata = validateBeautyMetadata(item.metadata);
    if (!metadata.allowPublicListing || codes.has(item.code)) throw Error('装扮库条目无效');
    codes.add(item.code);
    const base = `items/${item.code}/${item.revision}`;
    if (item.file !== base + '.json' || ![base+'.png',base+'.webp'].includes(item.cover)) throw Error('装扮库资源地址无效');
    return {code:item.code,revision:item.revision,sha256:item.sha256,bytes:item.bytes,kind:item.kind,metadata,categories:item.categories,cover:item.cover,file:item.file};
  });
  return {version:1,generatedAt:value.generatedAt,entries};
}
/** Sorting happens once per visit. Search/pagination never reshuffle the same visit. */
export function shuffleCatalog<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}
