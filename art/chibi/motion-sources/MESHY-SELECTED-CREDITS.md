# Meshy 用户导出动作 · 2026-09-30

来源：用户提供的 `Meshy_AI_current_body_unrigged_biped.zip`，使用用户自己的二号素体模型在 Meshy 导出。动作提供方为 **Meshy 动作库**；不能将这些动作标记为 CC0 或开源。包内没有额外许可证文本，保留 Meshy 导出授权条件。未上传或公开发布原 GLB。

| 原试看编号 | 原始动作名 | 用户确认用途 |
| --- | --- | --- |
| 01 | `sleep` | 睡觉：入床动作后播放一次，末帧保持；起身逆向回放 |
| 04 | `Sit_Cross_Legged` | 花瓣矮垫的盘腿坐姿替补；原平放腿坐姿仍可选 |
| 06 | `Idle_15` | 衣橱成功穿上新衣服后播放一次；移除、改色、改版型不触发 |
| 07 | `Stand_and_Drink` | 咖啡萃取结束后喝一口；杯子跟随左手 |
| 08 | `Wave_for_Help_3` | 挥手替补一 |
| 09 | `Wave_for_Help_4` | 挥手替补二 |
| 10 | `Walking` | 二号素体默认行走，替换此前选定的 Overte 走路 |
| 13 | `circle_crunch` | 瑜伽垫卷腹，四个循环后结束，可中途停止 |

睡觉原始页面：<https://www.meshy.ai/zh/animation-library/daily-actions/sleeping/sleep>。其余保留包内精确动作名，不猜测未确认的素材页面路径。

每个文件的完整文件名、SHA256、时长，以及整个 ZIP 的 SHA256 见 [导出包登记](meshy-user-pack-20260930.json)。原文件保留在本地 `output/meshy-motion-audition/assets/`。

复现：`pnpm node art/chibi/import-meshy-motions.mjs`。产物 `apps/room3d/chibi/meshyMotions.json` 仅含所选动作的关节四元数、归一化骨盆位移和来源身份；从 inverse bind matrices 恢复绑定姿态，以 30 Hz 转接 28 骨到项目 48 骨，不替换身体或服装，不改变骨长。手指、前臂 twist、脚底/床面接触和卷腹的地面高度为项目适配。未选的 02、03、05、11、12、14 仍只供原片对照。

致谢文案：**部分角色动作来自 Meshy 动作库，使用用户提供的导出文件，已适配本项目角色骨架。动作原名与对应用途见本清单。**

目前瑜伽垫为动作期间的临时纯色垫，不写入家具存档。房间没有可达且足够宽敞的空地时拒绝开始；预览页的「动作练习区」用于直接查看这些动作。下垫/起立还没有独立来源动作，不能把它描述为完整的健身动作链。
