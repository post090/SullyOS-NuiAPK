# 合照静态姿势来源

本地挑选页：`test/fixtures/room3d-motion-library.html?view=poses`。
54 项免费静态姿势，使用作者原缩略图和源骨架定格预览，尚未重定向到 Chibi / 二号素体；源图中的模型、衣物、椅子、杯子、手袋不作为本项目素材引入。

| 来源 | 实际数量 | 原包 SHA256 |
| --- | ---: | --- |
| [MakeHuman Poses 03：站姿](https://static.makehumancommunity.org/assets/assetpacks/poses03.html) | 36 | `9ea09bab67c99fecf35d149fcb295c2cfa998167053aad2bab566d9053a8acf8` |
| [MakeHuman Poses 01：坐姿](https://static.makehumancommunity.org/assets/assetpacks/poses01.html) | 18 | `67b1d14923adda85f371f81e1c529fcd058f975d0bf93848838e1a3860705b7d` |

官方逐项清单均标注 CC0；作者包括 Anrico、blindsaypatten、callharvey3d、DredNicolson、Elvaerwyn、gpedroso、jjones、milkman、Mindfront、punkduck、sohh、sweetan008、wolgade、xhado84。原始文件名、可用的 `.meta` 署名、每文件 SHA256 和目录页快照保留在 `output/social-motion-intake/poses/`，不把骨架预览署名为原创。

处理：Three BVHLoader 解析源骨架/旋转；按 [MakeHuman BVH 导入器](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/shared/bvh.py) 的 `onlyroot` 约定忽略非根平移轨（一些文件重复写入静止偏移，直接相加会拉长四肢），整体由 Z-up 转 Y-up。所有条目显示源第 0 帧，包含两份 250 帧的 Anrico 站姿文件，均明确作为静态姿势挑选。移除脸部/胸部辅助点的绘制，保留源手指骨；按完整姿势高度统一预览大小、居中落地，不改源文件，也不声称身高差已适配。

恢复原包与解压：`pnpm exec node art/chibi/download-photo-poses.mjs`。
离线验证和生成预览目录：`pnpm exec node art/chibi/catalog-photo-poses.mjs`。
作者 `.thumb` 直接复制为浏览器可用图像文件，未改画；本地预览缓存是单帧关节点，原始 BVH 始终保留。

两套额外免费包已实际尝试下载，端点均返回 BOOTH 登录页，没有假装下载成功，也没有计入上述 54 项：

- [りえる 13 姿势](https://booth.pm/ja/items/8299154)：`https://booth.pm/downloadables/8847943?variation_id=13873666`。
- [GOD POSE 6 Free：5 姿势](https://booth.pm/ja/items/7985916)：`https://booth.pm/downloadables/8404964?variation_id=13371420`。

两者禁止再分发姿势数据；仅为待取得的本地审片候选，不引入正式产品，不购买支援版或其他付费包。实际响应状态保存在本地 `download-manifest.json`。

2026-10-04 正式拍照接入：仅将 home-approved-selection.json 已确认的 14 项 poses01/poses03 素材适配到家园素体。build-photo-poses.mjs 校验源 SHA256，以源第 0 帧生成静态旋转轨并保留原缩略图/署名；产物在 public/room3d/motions/photo/。未接入新增 poses02/04 或组合示意，未复制源模型与道具。
