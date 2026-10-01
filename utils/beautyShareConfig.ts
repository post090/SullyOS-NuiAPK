// `?.` 不是装饰：worker bundle（esbuild neutral）里 import.meta.env 不存在，
// 顶层直接读会在 Cloudflare 上传校验时炸掉（10021）。
export const BEAUTY_SHARE_URL = (import.meta.env?.VITE_BEAUTY_SHARE_URL || 'https://beauty.friedsully.com').replace(/\/$/, '');
