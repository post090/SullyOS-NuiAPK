# CC0 静态拍照候选 · 2026-10-04

本轮用户要求：只下载、摆出来逐项确认，静态即可；不接拍照功能、不重定向角色。

预览：`/test/fixtures/photo-cc0-review.html`。与已有选定姿势目录隔离，不更改原有 14 项确认结果。

原包、原始 BVH / meta / thumb、来源网页快照、逐文件 SHA256 和解析验证结果均在 `output/photo-cc0-review/`。恢复：`pnpm node art/chibi/download-photo-cc0-review.mjs`；离线生成：`pnpm node art/chibi/catalog-photo-cc0-review.mjs`。

## 来源
- https://static.makehumancommunity.org/assets/assetpacks/poses01.html — 18 坐姿，先前已有，本轮重新下载留档。
- https://static.makehumancommunity.org/assets/assetpacks/poses03.html — 36 站姿，先前已有，本轮重新下载留档。
- https://static.makehumancommunity.org/assets/assetpacks/poses02.html — 新增 23 运动静态姿势。
- https://static.makehumancommunity.org/assets/assetpacks/poses04.html — 新增 13 戏剧/幻想静态姿势。

上述官方清单逐项标注 CC0。目录生成器核对每个文件名对应的授权行，并保留作者信息；原包 SHA256 在 download-manifest.json，BVH SHA256 在 catalog.json。总计 90 单人姿势，其中新增 36。

6 组双人构图仅由上述 CC0 单人姿势并置/旋转，不是下载来的原生双人互动资产。不提供未核实 CC0 的拥抱/牵手源包。组合配置在 pairs.json；没有手部接触求解或身高适配。

预览复用既有 MakeHuman onlyroot 解析约定，静态取第0帧，以骨架关节显示，原始文件不改动。原作者缩略图仅供对照；图中的人物/衣服/道具不作为新资产引入。勾选只保存到本地候选清单，不写入用户正式已批准目录。

验证：90 单人和6组合依次读取与渲染成功，无页面错误；勾选与分类可用。single-review.png / pair-review.png 为本轮实际截图。
