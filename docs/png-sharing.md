# PNG 分享卡

在可复用内容的导出入口制作分享图：上传预览图，填写作品名称、作者和使用限制，选择留白相纸、全幅海报或横版名片。接收方在对应功能的原有导入入口选择 PNG 原文件即可还原。原格式导出仍可用。

手机端默认显示大图，点击悬浮的「调整样式」展开底部小面板。面板分为「图片与排版」「文字与署名」，只在面板内滚动，预览始终留在上方实时更新。点击「收起设置」恢复大图，填写内容保留。键盘弹出时根据可视区域缩小编辑器并保持当前输入项可见；Escape 先收起设置，再次按下才关闭编辑器。桌面端保持预览和设置并排显示。

| 内容 | 导出 / 导入位置 | 原格式 |
| --- | --- | --- |
| 角色卡 | 角色详情导出 / 角色列表导入 | JSON |
| 世界书 | 分组导出 / 世界书导入 | JSON |
| 白框 CSS | 白框编辑器「导出分享」「导入 PNG / CSS」 | TXT / CSS |
| 白框预设集 | 我的预设「图片分享」「图片导入」 | SULLYCSS1 文本；原剪贴板分享保留 |
| 白框提示音 | 提示音编辑器「图片分享」「图片导入」 | SULLYSND1 文本；原剪贴板分享保留 |
| 日记 CSS | 日记外观编辑器 | CSS |
| 气泡主题 | 气泡制作器的已存主题 | JSON |
| 外观预设 | 外观预设管理 | ZIP；兼容旧 JSON |
| 剧情预设 | 剧情预设库、制作器及装载入口 | JSON |
| 小屋样板房 | 小屋样板房导出 / 导入 | JSON |
| 像素小屋 | 像素家园底部导出 / 导入 | JSON |

PNG 内含原文件的完整字节，图片本身不需要联网才能恢复内容。内容中原有的外链仍然是外链。角色卡沿用现有字段剥离和本机图片令牌转资源流程；系统备份、诊断日志、聊天记录及直接下载的媒体仍走原有文件出口。

## 使用边界

- 分享的是 PNG 原文件。截图、重编码、图片压缩、转成 JPG/WebP 或删除图片元数据，可能丢失内容；建议按文件发送。
- 使用限制展示在图片上并随元数据保存，是作者说明，不是加密或权限控制。导入时仍执行对应功能原有的校验、合并或覆盖规则。
- 仅识别 SullyOS 分享卡，不把普通 PNG 或其它应用的角色 PNG 当作 SullyOS 数据导入。
- 预览图限制 20 MB / 4000 万像素；内嵌内容上限 64 MB，整张 PNG 上限 96 MB。超限可用原格式导出。
- 作者、作品名、使用限制的编辑只作用于本次分享图，不改动源角色/预设。预览图居中裁切；GIF 导出当前预览帧。

## 实现

`utils/shareExport.ts` 的文本与 Blob 入口接受可选的 `card` 参数，按需加载分享编辑器。调用方应处理 `cancelled`，取消时不显示成功提示。PNG 和原文件都复用原生分享 → Web Share → 浏览器下载的适配；Capacitor 的 `Share canceled` 和 Web Share 的 `AbortError` 都返回取消。

`utils/pngShare.ts` 在 IEND 前写入私有辅助数据块 `suLy`。布局遵循 [W3C PNG 第三版](https://www.w3.org/TR/png-3/#5Chunk-layout)：8 字节 `SullyOS\0` 标识、4 字节大端元信息长度、UTF-8 JSON 元信息、原文件二进制字节。元信息包含 format/version/kind/title/author/restrictions/style/fileName/mimeType，不使用 base64 扩充原文件。

导入检查 PNG 标识、分块边界、CRC、数据块重复、协议版本、内容类型、文件名和体积，确认后还原 File 交给原功能导入。重新封装时移除已有 `suLy`，防止残留上一份分享内容。图片 CRC 用于检测损坏，不用于证明作者身份。扩展新内容类型时，需同时接入导出 `card.kind`、PNG 文件选择器和 `readShareFile` / `readShareText`，再执行原内容校验。

分享卡使用统一 Canvas 生成预览，导出直接读取这张 Canvas，因此文件与预览逐像素一致。编辑器使用原生 dialog，支持键盘焦点限制、Escape 取消及减少动态效果偏好。移动端设置面板最高 320px，且不超过内容区高度的 46%；VisualViewport 变化时同步可用高度和位置，避免软键盘遮住预览、输入项或导出按钮。

## 验证

```sh
node node_modules/vitest/vitest.mjs run utils/pngShare.test.ts utils/shareExport.test.ts utils/shareExportNative.test.ts utils/exportShareAudit.test.ts utils/characterCard.test.ts utils/exportGuard.test.ts utils/worldbook.test.ts utils/storyTheater.test.ts
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort
node scripts/test-png-share-ui.mjs
```

UI 脚本使用 Playwright，可通过 `PLAYWRIGHT_MODULE` 指定其绝对模块路径，通过 `PNG_SHARE_BROWSER_CHANNEL=msedge` 使用已安装的 Edge，通过 `PNG_SHARE_QA_URL` 修改测试地址。测试使用隔离浏览器存储并阻止外部网络请求；检查三种布局、真实图片上传、320px / 390px 屏幕上预览与设置同时可见、独立滚动、VisualViewport 键盘缩小模拟、收起展开保留编辑、长文案、像素一致性、下载、取消/重试、原 JSON、真实 CSS 编辑器往返和实际角色导入。结果在 `output/png-share-qa/`。可视区域模拟不等于 Android / iPhone 真机键盘测试。
