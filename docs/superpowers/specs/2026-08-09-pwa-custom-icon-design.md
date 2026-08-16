# 自定义 PWA 应用图标

## 这是什么

用户在「外观定制 → 应用图标」里上传一张图（或填图床链接），直接当 SullyOS 的主屏图标用。
iOS 和 Android 两边都支持，不需要把图传到公网。

## 怎么做到的

启动时 JS 动态注入两样东西：

| 平台 | 注入点 | 怎么写 |
|------|--------|--------|
| iOS | `<link rel="apple-touch-icon">` | `href` 直接写 `data:image/png;base64,...` |
| Android / Chrome | `<link rel="manifest">` | 用 `URL.createObjectURL(new Blob(...))` 生成临时 manifest，图标 `src` 写 data: URI |

2026-08-04 真机实测 iOS 26.5.2 和 Android 17 (Chrome, Pixel 8) 都认 data: URI，两端全通。

## 一条硬约束：装上之后改不了

iOS 读 `apple-touch-icon`、Chrome 读 manifest 里的图标，都只在「添加到主屏幕」那一刻取一次。
装完之后再怎么改页面，主屏和通知上的图标都不变。

**要看到新图标，只能删掉 App 重新「添加到主屏幕」。**

SullyOS 是 local-first 应用，数据全在 IndexedDB 里。iOS 上 PWA 的存储跟浏览器里打开的是两份，不同 PWA 之间也互相隔离——删 App 等于把那一份数据清掉。

所以 UI 上必须把这句话说清楚，并指向备份导出。

## 涉及的文件

### 新建

| 文件 | 干什么 |
|------|--------|
| `utils/appIcon.ts` | 注入/清除 PWA 图标的核心逻辑：读 blobRef 令牌→解出 data URL→写进 DOM |
| `components/appearance/AppIconEditor.tsx` | 上传/链接切换、预览、环境感知警告 |

### 改动

| 文件 | 改什么 |
|------|--------|
| `apps/Appearance.tsx` | 「应用图标」标签页顶部塞 PWA 图标卡片 |
| `context/OSContext.tsx`（轻量） | 启动时读已保存的 PWA 图标并注入；提供读取入口 |

## AppIconEditor 的 UI

### 模式切换

提供两个 tab 切换，同一时间只展示一种：

- **上传图片**：文件选择器（accept image），选完即时预览
- **填入链接**：文本输入框，输完点「确认」拉图并预览

### 环境感知提示

两条信息卡片，按实际环境展示对应那条：

**浏览器里打开时（非 standalone）：**
> 标签页图标已更新 ✨
> 下次「添加到主屏幕」时就会用新图标啦～装好的 App 不受影响。

蓝底，轻提示。

**已装成 App（standalone display-mode）：**
> ⚠️ **删掉重装会丢数据** ⚠️
>
> 主屏图标只在「添加到主屏幕」时读取一次，装完之后改不了。
> 要看到新图标，只能删掉 App 重新添加。
>
> 装成 App 的 SullyOS，数据是单独的一份——跟浏览器里打开的不通，跟别的 PWA 也互相隔离。
> 删掉 App，这一份就跟着没了。
>
> **删之前一定要先备份**：设置 → 备份 → 导出，重装完再导入。

红底，两个 ⚠️ 分列标题两侧，关键句红色加粗。

### 图标状态

- 已经设了自定义图标 → 显示当前图标预览 + 「重置为默认」按钮
- 没设过 → 显示默认图标 + 引导文字

## appIcon.ts 的接口

```ts
// 把 blobRef 令牌解成 data URL 并注入 DOM。
// standalone 下同时替换 manifest 和 apple-touch-icon；
// 非 standalone 下只换 apple-touch-icon（浏览器标签页图标）。
async function injectPwaIcon(blobRef: string): Promise<void>

// 恢复默认图标（删掉注入的 link/manifest，指回原始文件）。
function clearPwaIcon(): void

// 启动时调用：检查是否有已保存的 PWA 图标，有就注入。
async function initPwaIcon(customIcons: Record<string, string>): Promise<void>
```

内部细节：
- manifest 替换要处理路径问题：`blob:` URL 的 manifest 里所有相对路径都会相对 blob 解析导致 404，所以动态 manifest 里的 `start_url`、`scope`、备用图标等全部折成绝对地址
- `apple-touch-icon` 直接设 `data:` URI，没有路径解析问题
- manifest 只在 `display-mode: standalone` 时替换——浏览器里替换 manifest 没意义，还可能在 DevTools 里刷出一堆 blob URL 干扰调试

## 存储

复用现有 `customIcons` 体系，appId 用特殊值 `_pwa_`：

- `setCustomIcon('_pwa_', blobRef)` — 存图
- `setCustomIcon('_pwa_', undefined)` — 重置
- 图走 `blobRef` 管线：压缩后的 Blob 存 IndexedDB blob_assets，字段里只存 `blobref:...` 令牌
- 备份导出链路已通：`resolveBlobRefsDeep` 会把 `_pwa_` 的令牌转回 data URL，跟其他自定义图标一起打进备份包

## 不想做的

- 不按角色换图标——通知图标来自 `showNotification` 的 `icon` 字段（Android）或 PWA 主屏图标（iOS），不是前端能动态改的
- 不做图标裁切/编辑器——传图前自己裁好，组件里只做等比缩放和压缩
- 图的大小上限 512px（跟现有 `handleIconUpload` 一样），覆盖 180、192、512 三个尺寸需求
