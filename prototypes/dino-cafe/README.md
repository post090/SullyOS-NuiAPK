# 橡皮泥恐龙箱庭试玩

为了保持浏览器中的链接可用，继续保留 `dino-cafe` 路径，内容已换为恐龙箱庭。功能说明与边界见 [DINOSAUR-GARDEN.md](../../apps/vrWorld/DINOSAUR-GARDEN.md)。

试玩与真实入口共用 `DinosaurGarden`、渲染器和存档逻辑。首次试玩种下十二只明确标注的示例藏品，分布在三张地图；示例来客不访问 LLM。原有本地收藏不会被整份重置。早期试玩布景升级只更新这份明确标记的示例地图，保留个体配色、名字和用户添加的摆件。生产入口只送一只入门赠礼，其余来自真实收藏。

```sh
pnpm install
pnpm exec vite --config prototypes/dino-cafe/vite.config.ts
```

打开 `http://127.0.0.1:5182/prototypes/dino-cafe/index.html`。

```sh
pnpm exec node prototypes/dino-cafe/generate-models.mjs
pnpm exec vitest run utils/vrWorld/dinosaurPlacement.test.ts utils/vrWorld/dinosaurActivities.test.ts utils/vrWorld/dinosaurGarden.test.ts utils/vrWorld/fishingMarket.test.ts utils/vrWorld/fishingSession.test.ts
pnpm exec vite build --config prototypes/dino-cafe/vite.config.ts
```

模型生成器使用 Three.js 在本机生成并简化连续体，产物直接放在 `public/dino-models`，不依赖建模 SaaS、生成 API 或外部模型下载。`manifest.json` 记录每只的实际三角面数和字节数。

浏览器 QA 使用 Playwright：`qa-garden.mjs`、`qa-integration.mjs` 和 `qa-performance.mjs`。本机无直接 Playwright 包时，可复用 `test/fixtures/playwright-loader.mjs`，设置 `FISHING_PLAYWRIGHT_MODULE` 为已安装运行时的 `playwright/index.mjs`，`FISHING_BROWSER_CHANNEL=chrome`。完整 SAR 测试需要把项目原用的 `https://cdn.tailwindcss.com` 脚本缓存到 `output/fishing-qa/tailwind.cdn.js`。

官方游戏检查脚本使用 `actions.json`，并读取 `window.render_game_to_text()` 和 `window.advanceTime(ms)`；渲染诊断提供当前地图、格位、居民、环境互动、实际动画位置、事件和绘制统计。截图与 JSON 输出不提交。

当前界面以整座庭院为主，底部「布置／恐龙／来访」。首次进入有可收起的三步引导；恐龙面板里「正在」只写一句话，位置自动决定与摆件的互动。新版草原示例会展示野餐、帐篷、树叶与浅水活动，沿用旧试玩存档时可通过「布置」自行补充新摆件。

摆放采用可取消的草稿：选摆件或恐龙后出现格子、光圈和朝向箭头，最后点「确定摆放」才保存。可直接点场景的小爪印选择互动玩具；恐龙固定在确认位置，只做原地头部、尾巴、脚部动作与相应物品反馈。原型与正式彼方共用这套逻辑。

面向用户的 SAR 全设施流程、角色行动与 LLM 调用次数：[SAR 活动室怎么玩](../../docs/sar-user-guide.md)。

艾文三星专属「？？？」使用 `aiven-chimera` 模型 ID，与普通恐龙共用材质、换色与箱庭动作。可用 `node prototypes/dino-cafe/generate-models.mjs --only=aiven-chimera` 只重建这一只，保留其他二进制模型。独立视觉检查在 `test/fixtures/aiven-chimera.html`（内存数据，无存档读写），运行 `scripts/test-aiven-chimera-model.mjs` 检查模型结构、换色、动作及三个屏宽。该模型的 catalog 条目不会自行进入随机垂钓池。
