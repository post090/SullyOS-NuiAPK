/**
 * 用户手动部署自己的 Worker 时用到的两个小工具：复制站点发布的 bundle、跳 Cloudflare 控制台。
 * 主动消息 2.0 的设置面板在用。
 */

/**
 * 复制站点随 build 发布的某个 worker bundle 到剪贴板（Dashboard 粘贴部署用）。
 *
 * 抛出原始错误让调用方决定怎么显示 (toast / inline status / 不显示)。
 */
export async function copyWorkerBundleToClipboard(bundleName: string): Promise<void> {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${base}${bundleName}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  await navigator.clipboard.writeText(text);
}

/**
 * 根据用户填的 workerUrl 推算 Cloudflare dashboard 编辑界面的 deep link。
 *
 * Cloudflare 接受 `?to=/:account/...` 模式, 登录后会自动用当前账号 ID 替换 :account
 * (多账号会出选择器)。这样我们不需要知道用户的 account ID, 只要从 workers.dev
 * 子域名里抠出 worker name 就能直达 /production 编辑界面。
 *
 * 非 workers.dev 域名 (自定义域 / 反代) 没法可靠反推 worker name, 退回 worker 列表页,
 * 用户自己点项目名进去 —— 这类用户清楚自己的部署结构, 不会被卡住。
 */
export function buildCloudflareDashboardUrl(workerUrl: string | undefined): string {
  const FALLBACK = 'https://dash.cloudflare.com/?to=/:account/workers/overview';
  if (!workerUrl) return FALLBACK;
  try {
    const u = new URL(workerUrl);
    if (u.hostname.endsWith('.workers.dev')) {
      const workerName = u.hostname.split('.')[0];
      if (workerName) {
        return `https://dash.cloudflare.com/?to=/:account/workers/services/view/${encodeURIComponent(workerName)}/production`;
      }
    }
  } catch { /* invalid url → fallback */ }
  return FALLBACK;
}
