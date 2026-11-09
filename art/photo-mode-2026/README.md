# 拍照性能与横幅构图（2026-10-29）

正式入口为家园小手机 → 拍照。默认全屏，按当前取景界面比例预览和导出，可选 16:9、2.39:1、3:4、9:16、1:1 及相纸；镜头页有居中、左侧留白、右侧留白和三分线。手机竖屏可点「横屏」，整个拍照界面旋转，拖动坐标随之转换；退出恢复现场相机、尺寸和像素比。

## 横屏取景与人物大小

- 全屏尺寸直接跟随拍照容器，不复用上一种画幅的测量值；切换和旋转后在绘制前重测普通画幅的可用区域。
- 全身画幅随方向在 9:16 / 16:9 间切换，3:4 画幅在横屏时为 4:3，标签与导出比例同步。电影、方形及有排版的相纸保持指定比例。
- 横屏只有展开调节面板时才预留侧栏；收起后释放空栏，纯净模式释放全部边距。面板最大高度使用旋转后的界面高度，避免把物理竖屏高度当成横屏高度。
- 默认全身缩放从 1 调整为 1.5，避免全屏时人物过小；旋转不会重置用户手调的镜头，也不恢复人物站姿。只有明确标注重置动作的站位按钮会改变双人动作。
- 照片保留按下快门时的比例与标签，后续切换方向不会改变已经拍下的照片。

当前回归包含实际 CSS 的侧栏/纯净边距检查、模拟尺寸切换、预览与导出比例、Three.js 人物投影占比及双人动作保持；不替代用户的实际设备界面验收。

## 渲染

- `photoRenderer.ts` 缓存场景原片，滤镜变化仅重做后期；镜头、角色姿势或现场资源变化使缓存失效。拍照期间没有额外的隐藏房间绘制。
- 拖动预览长边 768，停止操作 160ms 后为 1280；快门使用独立长边 2560 的导出画布。正交视锥按画幅重算，未拉伸房间。
- `photoEffects.ts` 复用辉光、模糊、色差画布；亮部提取最长边 640，像素读取画布使用 `willReadFrequently`。
- 辅助线、画幅标签和按钮都是 DOM，不进入 PNG；照片仍沿用原分享/保存链路。

## 参考与取舍

- [R3F 性能指南](https://r3f.docs.pmnd.rs/advanced/scaling-performance)：按需绘制、自适应分辨率。本项目直接使用 Three.js，采用机制而未引入 R3F。
- [Three.js UnrealBloomPass](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/UnrealBloomPass.js)：降低泛光中间缓冲分辨率，保留主体清晰度。
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)：研究效果合并；此次保留现有 2D 后期，不声称完成 GPU 后期迁移。
- [PlayCanvas 正交投影](https://developer.playcanvas.com/user-manual/graphics/cameras/projection/)：保持垂直视野、按长宽比计算水平视野。

## 验证

`pnpm vitest run utils/homePhotoMode.test.ts utils/homePhotoRenderer.test.ts utils/homePhotoSession.test.ts utils/homePhotoActionsUI.test.ts utils/homePhotoLibrary.test.ts --no-cache --maxWorkers=2 --minWorkers=1`：16 项通过。独立正式模块入口 Vite 生产构建通过。全库 TypeScript 检查有既有错误，不列为通过项。

`review.mjs` 的真实 Edge 验收见 `qa/report.json`：12 次滤镜调整没有新增场景捕获；电影画幅导出 2560×1071；辅助线开关前后 PNG SHA256 完全一致；手机旋转拖动、退出恢复通过，无页面异常。develop-web-game 客户端另验收自动进入拍照页面，截图见 `skill-qa/shot-2.png`。

1920×1080 固定测试图、晴空物语后期、预热两次后测八次：旧实现中位数 170.3ms，新实现 85.9ms，约减少 50%。前次复测为 160.2 → 85.6ms。只代表本机后期处理耗时，不代表整场景 FPS 或手机性能；基线为 `paintPhoto-before.ts`。

本地预览：`http://127.0.0.1:5206/test/fixtures/room3d-photo.html?photo`。尚未部署。
