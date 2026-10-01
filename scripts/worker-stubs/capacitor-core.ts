/**
 * Worker 构建里的 @capacitor/core 假身（见 scripts/build-workers.mjs 的 alias）。
 *
 * 真包是浏览器原生桥，只在 APK WebView 里有意义，但 db.ts → mcpClient.ts 的 import
 * 链会把它拖进 worker bundle。以前靠 esbuild 标 external 跳过，结果 bundle 里留下一行
 * 裸导入——而 Cloudflare 的模块 Worker 上传（面板粘贴 / 自更新 / wrangler 三条路）都不认
 * 裸导入，一律 10021 拒收。所以改在这里给个假身：isNativePlatform() 永远 false，
 * worker 里本来也永远走不到原生分支，这让死分支保持死；CapacitorHttp 真被碰到说明
 * 代码写错了，抛错比静默装死强。
 */

export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web' as const,
};

export const CapacitorHttp = {
  request: (): never => {
    throw new Error('CapacitorHttp is not available in workers');
  },
};
