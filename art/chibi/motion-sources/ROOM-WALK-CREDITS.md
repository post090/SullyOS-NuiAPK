# 当前日常走路：Meshy 10

2026-09-30 用户确认仅保留 Meshy `Walking`。运行时入口是 `approvedRoomWalk.ts`，具体来源见 [Meshy 致谢](MESHY-SELECTED-CREDITS.md)。旧四段走路候选、选择按钮及采样数据已移除；以下只保留历史来源记录。共享许可证仍供其他已选衣橱动作使用。

## 历史记录（已停用）


2026-09-29 用户确认 **2 日常走路 / overte-walk**，设为二号所有房间的默认走路。其余三段仅保留在对照页临时比较；不替换已经确认的五段衣橱动作。页面提供作者/来源链接。

正式数据为 `apps/room3d/chibi/approvedRoomWalk.json`（从已校验的 `test/fixtures/room-walk-overte.json` 提取 `overte-walk`，不改采样值），`visitor` 创建二号时即设置该动作；原版 Chibi 不变。发布用 Apache-2.0 许可、NOTICE 与上游转换说明位于 `public/room3d/motions/`，随生产构建分发。预览刷新也默认选中 2。

## 1 短步慢走、2 日常走路

- 原作者/项目：Overte / High Fidelity 系列；VRMA 转换：Hanami / Undi95。
- 许可：Apache-2.0；随附 [完整许可](Overte-LICENSE-Apache-2.0.txt) 与 [转换 NOTICE](Hanami-NOTICE.md)。
- Copyright (c) 2013–2019 High Fidelity, Inc.; 2019–2021 Vircadia contributors; 2022–2026 Overte e.V.
- [原始 FBX 目录](https://github.com/overte-org/overte/tree/master/interface/resources/avatar/animations)：`walk_short_fwd.fbx`、`walk_fwd.fbx`。
- 固定转换版本 `6787685c8d40e4e79bffbb0d389b478f32ef88d6`。
- [world-walk-slow.vrma](https://github.com/Undi95/Hanami/blob/6787685c8d40e4e79bffbb0d389b478f32ef88d6/vrma/world-walk-slow.vrma)，1.30 秒，SHA256 `ba954b7e6ef8ad97b587be0f440894624792e5b21e2b0dd85dfc7c7ddc7afc7f`。
- [world-walk.vrma](https://github.com/Undi95/Hanami/blob/6787685c8d40e4e79bffbb0d389b478f32ef88d6/vrma/world-walk.vrma)，1.00 秒，SHA256 `1a41df323c51599bbafb1c7d2b72e723a6f6a95c61286e3ec9f38385a2b841b3`。
- 重建：`pnpm node art/chibi/import-vrma-wardrobe.mjs <VRMA目录> test/fixtures/room-walk-overte.json art/chibi/motion-sources/room-walk-manifest.json`。生成器强制核验以上源文件哈希。

## 3 舒展步伐、4 端正步伐

- 原作者/项目：Mesh2Motion；动作名 `Walk`、`Walk_Formal`，各约 1.667 秒；未确认个人动画师，不虚构个人署名。
- 动作素材许可：CC0；[随附许可](Mesh2Motion-LICENSE-CC0.md)。
- [固定原包](https://github.com/Mesh2Motion/mesh2motion-app/blob/3ce7f9d97d25e608b4779ce797da343775ded62b/static/animations/human-base-animations.glb)，SHA256 `406eb0a8dc4ab366e623b79b6e3005a4951392e1bda78ae39c1099d31147733c`。
- 重建：`pnpm node art/chibi/import-wardrobe-motions.mjs <原GLB路径> test/fixtures/room-walk-mesh2motion.json art/chibi/motion-sources/room-walk-mesh2motion.json`。沿用已验证的生成器，默认衣橱生成命令不变。

## 本项目适配

保留原动作循环节奏，用绑定姿势的世界旋转差转为当前骨架旋转；合并胸部层级，不复制模型、表情、源根位移或改变骨长。手指沿用轻握，复用前臂 twist 分配。不同于旧衣橱窄站姿，这次保留完整髋腿脚轨道。

播放时以当前骨长计算步幅估计移动速度，随角色整体大小同步；较低脚踝回到自身站立平面，保留摆腿。此处理不是完整脚底 IK 锁定，也不保证所有鞋底转角或衣物碰撞。没有导入起步/停步独立素材，没有新增睡眠候选。已选 2 为正式默认；对照页切换其他候选仅在会话内有效，不改角色存档。

本轮未取得 sashii 的 Josie VRMA 包：作者免费入口要求 BOOTH 登录。未将未取得的素材列为可播放候选。
