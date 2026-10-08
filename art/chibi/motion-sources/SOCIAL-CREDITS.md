# 双人动作试验场来源（2026-10-02）

## 2026-10-02 · 确认动作实装

以用户第二份 JSON 选单为准：**39 个动态动作（18 组成对、21 个单人）+ 14 个静态拍照姿势**。冻结清单见 `art/chibi/motion-sources/home-approved-selection.json`。拍照姿势暂存，未接入拍照玩法。

正式小屋右上角「一起玩」接入 `HomeSocialPanel`：可以邀请保存过彼方形象的 user、保存过手办形象的其他角色；选主动方/回应方，全场统一 Chibi 或二号素体，邀请者可各调 80–125% 身高。最多四位同时在场，任意一位可做单人动作，任意两位可做成对动作，其余保持独立状态。居民、动作和临时道具不写入房间布置存档。

分类：招呼与示好、聊天交流、关心照顾、亲近陪伴、玩闹活动、闹别扭、自己的小动作。单人拳击仍是练拳；亲密拥抱、摸头、摸脸没有确认素材，不补造动作。原家具活动及早先确认的行走素材不属于这次丢弃范围。

`build-selected-motions.mjs` 仅转换已选文件：统一 rest-space 骨架映射、30 fps 四元数轨、共用原时间轴和根位移。各对角色共用同一个源空间缩放，二号素体在原骨长上做手部接触校正、足底防下穿、大头间距与搭肩躯干倾斜约束；Chibi 用源手轨驱动浮动小手。手机、汽水为动作期间的纯几何临时道具。角色帧完成后刷新衣物与蒙皮包围盒。

动作包在 `public/room3d/motions/selected/`，39 项按需加载（约 9.9 MB JSON 总量，不塞入首屏脚本）。同目录保留 CMU 许可、Hanami 完整 NOTICE、来源 URL、SHA256 和修改说明；不能统称 CC0。源文件仍在忽略目录 `output/social-motion-intake/`，未选的 482 个文件/约 97.6 MB 已删除，AIRYAA Hug Me 与未选候选不再展示。下载脚本只恢复确认源与许可，静态姿势包只解出确认的14个。

运行时：只允许一个会话；加载中取消不会复活旧动作。结束/停止回到开始站位，换素体、布置、总览、换房、家具活动或离开页面取消动作与临时道具。正式小屋在启动前检查接近段、完整根轨与旁观者占位；空间不足明确提示，不穿家具去硬播。此阶段尚不是自主社交 AI，也没有通用衣服/头发精确碰撞；不同自定义衣物仍需视觉检查。

验收入口：`test/fixtures/room3d-social.html`（两种素体、三位测试居民、身高差、全动作进度）；`room3d-home-social.html`（实际 Home3DView 的隔离家园）；`room3d-motion-library.html`（只保留39原片/14拍照姿势）。测试角色与空房不读取用户家园布置。


以下为素材研究历史，已弃用候选与旧数量不代表当前实装状态。

## Hug Me 本地载入（2026-10-02，最新状态）

用户要求先载入 AIRYAA Hug Me、暂不考虑付费。原 ZIP 与三条 VMD 已在本地；动作库新增 `?motion=hug-me-airyaa`，两条主角轨共用完整 28.533 秒时间轴，短轨在末帧保持，不截掉长轨结尾。额外配角轨仍在原包中，不混入双人预览。现为 **234 项源骨架预览 + 1 项 MMD 参考骨架预览**，39 项确认原片不变。两组纯付费候选标记 `deferred`，当前挑选页隐藏，下方历史研究记录保留。

VMD 的原模型名为 Tda Base，但包内不含其角色骨架。为本地试看采用 [Three 官方 r169 示例 Miku PMD](https://github.com/mrdoob/three.js/tree/37d6f280a5cd642e801469bb048f52300d31258e/examples/models/mmd/miku) 的参考骨位置与腿部 IK；原模型署名/许可文件在 `couple-research/MMD-reference/`。该模型不属于 Three 的 MIT 许可，不展示/分发其网格、纹理或角色形象。PMD SHA256：`45a5a2fb897266a1b371b30cf53ed9435d375ddea9fce7f095bba2739b9bdae5`。

离线脚本 `pnpm exec node art/chibi/preview-airyaa-hug.mjs` 验证两条 VMD 和 PMD 哈希，以 mmd-parser 解析右手坐标、按 VMD Bézier 曲线逐帧采样位置和旋转、用 Three CCDIKSolver 解腿部 IK。曲线布局及 PMD IK 角度约定参考 [Three r169 MMDLoader](https://github.com/mrdoob/three.js/blob/r169/examples/jsm/loaders/MMDLoader.js)。缺少的总根、groove、足 IK 父控制补入参考层级，上半身2支点为参考躯干中点估计。输出 30 fps 世界关节点缓存到忽略的 `AIRYAA/reference-preview.json`；不输出至 public 或正式角色动作包。

**试看限制**：这不是原 Tda 骨架，也不是 Chibi/二号素体重定向。握拳/散指和部分拇指控制未还原，未显示手指、表情、头发、衣物、道具、音频、原相机和物理。输出逐轨保留未映射的有效骨名，不把这些差异藏掉。接触间距不能作为最终适配验收。根轨自身包含剧情切镜与人物移出场景，保留其跳变，不擅自挪动单人或补造循环；载入默认停在双人段 388 帧，完整时间轴可重播，并提供当前姿势聚焦和全片取景。

验证：847 / 857 帧双人缓存均为有限数；浏览器检查切镜前后、终点、重复拖动的确定性、半速/暂停/循环、BVH与VRMA切换、候选载入按钮、39项确认与导出、390px布局，无页面/控制台错误。Vite独立构建通过（已有大chunk提示）；技能脚本动作截图、0/14.2/26.2秒与手机截图已查看。可供选片，不宣称解决角色穿模。

## 导出清单确认与情侣扩搜（2026-10-02，最新）

用户提交 `sully-motion-selection.json` 并明确说“这些可以”。**39 项均已确认原片**（包含原 01/02/03，新增 36 项），不能因导出时 `approvedSource:false` 而忽略本次口头确认。已逐项匹配本地目录的 ID / 文件路径，保存 [social-approved-selection.json](social-approved-selection.json)（含原导出 SHA256）。目录生成器重建后仍保留全部 39 项；页面“已确认”过滤和再次导出也保留它们。未选项留作备选，不擅自当作删除要求。此次确认仍仅针对源动作，并非适配后的身体、衣物和身高差验收。

情侣新候选及实际状态见 [couple-candidates.json](couple-candidates.json)，并呈现在动作库 `#couple-candidates`。本轮新增 **8 组候选，其中 1 个包已实际下载**：

- **AIRYAA / Hug Me**：[作者原演示](https://www.youtube.com/watch?v=v1BfTlZNxg0)公开描述提供 MediaFire 原始链接。4,967,905-byte ZIP 已存 `output/social-motion-intake/couple-research/AIRYAA-100-subs-special.zip`，SHA256 `cb628172c92c9a0dd7d1e755d4b98f94df6b73f06641d79dcf4297695b7d21a3`。原包中的 `1st model.vmd`（28.2s）、`2nd model.vmd`（28.533s）及 `the wooo one.vmd`（25.7s）已提取、用 mmd-parser 完整解析并检查骨关键帧有限数值；后者是额外角色轨，不计为第三对拥抱。附带 readme 要求署名/链接作者视频、禁止再分发，允许为适配模型修改。本地审片保存，不发布原始动作或附带音频。VMD 不含完整角色静止骨架，未强行当 BVH/VRMA 播放；未完成 MMD 角色适配，也未确认剧情能裁为自然拥抱循环。
- **RBStudio / [250+ Romantic Animations For Couples](https://www.fab.com/listings/e5db9476-93c1-4d2c-b1c6-4cb33ef68776)**：站/坐/躺拥抱与轻吻、双方同步的停留与衔接片段，第 1 包明确列 FBX；Part 2/3 原页仅明确 Unreal 格式。付费未购买，数量含双方和过渡，不是 250 对独立动作。网页 AI 标记不擅自解释成一切 AI 应用禁用；产品引入时核对具体许可。
- **Reallusion / [Motions for Lovers](https://www.reallusion.com/ContentStore/iClone/pack/Motions-for-Lovers/default.html)**：相遇、牵手散步、互望、慢舞、接吻与依偎；[官方发布说明](https://forum.reallusion.com/520318/Forum199.aspx)说明 iClone 8 工作流及 FBX/BVH 导出。付费未购买。
- **MoCap Central / [Free Sample](https://mocapcentral.com/products/mocap-studio-series-sample-pack-free)**：[实际清单](https://mocapcentral.com/pages/sample-animation-list)明确包含 `am_Pair_Stand_Propose_Success_A` / `af_Pair_Stand_Propose_Success_B`。免费样包可提供 FBX，公开产品页未提供可直接取用原包 URL，需商店领取，未取得。没有把全部 120+ 样例当成情侣动作数。
- **A-sh [Selestia 2人 Motion](https://booth.pm/ja/items/4514593)**、**SOShop [Couple pose](https://booth.pm/en/items/4658134)**、**hezdqma [Couple Pose Animation Pack 1 免费版](https://booth.pm/ja/items/4964592)**：已尝试真实免费端点，三者均返回 BOOTH 登录页，没有取得 ZIP。A-sh 明说两个姿势有运动；其余及完整进入/退出过程仍需源文件确认，不把姿势截图当完整双人动画。
- **Sukaretto Gonzales / [Little Kiss](https://www.youtube.com/watch?v=kgHPwt7GvuM)**：作者标明 f2u，下载指向 Patreon 帖子 79668445，本次 HTTP403；未取得。另查 CxtBoyo Hug 作者页也403，不作为已下载候选计数。

另排除 UC-3D 作为完整配对来源：官方明确两人互动只采集一位演员的 MVN，不可把它称为成对拥抱轨。所有下载状态和公开页面快照在本地 `couple-research/`，不含登录凭据。新增 VMD 未增加原 234 项可播放条目数。

验证：39 项已确认过滤/牵手搜索/禁止取消已确认/导出39条确认数据，8组候选、本地 ZIP 可取、390px 无横向溢出全部通过，无浏览器错误；Vite 独立构建通过，仅大 chunk 提示。技能脚本与桌面/手机候选截图均已查看。没有购买或提交账户信息。

## 本地动作库实况（2026-10-02，晚于下方研究记录）

用户澄清“表情”是全身动作 / emote，并要求先尽量下载到本地再挑选。现有 `test/fixtures/room3d-motion-library.html` 提供 **234 项可播放源动作**，搜索、分类、¼/½ 速、进度、重播、循环、收藏及 JSON 导出；原片 01/02/03 固定保留已选。使用原骨架呈现，不宣称已经适配 Chibi / 二号素体或解决接触穿模。

| 已实际取得 | 数量 | 本地目录 / 说明 |
| --- | ---: | --- |
| Hanami VRMA | 166 文件 | `output/social-motion-intake/Hanami/vrma/`；151 根目录 + 15 extra，包含 Overte、Rocketbox、Quaternius 等来源，各自许可见随包 NOTICE；不能统一称 CC0 |
| VoxAvatar CC0 镜像 | 13 文件 | `voxavatar/public/assets/animations/`；Sachi、rerofumi、sashii / JenJell，作者与原包关联见随附 manifest、ASSET_LICENSES |
| pixiv three-vrm 示例 | 1 文件 | `pixiv/packages/three-vrm-animation/examples/models/test.vrma`；官方测试片段，不是 VRoid 七动作商品包 |
| CMU 18–23 双人系列 | 106 BVH / 53 组 | `CMU/`；握手、交谈、争论、挽手、击掌、牵手、揉肩、起身、递物等，A/B 成对保留。全部共用原世界坐标和时间轴 |
| ReForge Unity Emotes | 4 `.anim` | `ReForge-Emotes/`；Angry、Idle、Magic、Suprised 原始文件，仅保存备用，未作为可播放项目计数 |

180 个 VRMA 文件 SHA256 均不同；有风格变体、起止和坐姿片段，**不等于 180 种完全独立的行为**。加 53 组成对 BVH 和原有已选 13_17 拳击，共 234 条浏览器选项。新取得身体动作和许可/来源文件合计 313 个、96,659,974 bytes。误解用户前下载的面部 FCL / `.anim` 保留在单独 `ReForge/` 目录，不计入此处身体动作数量，不继续扩充。

完整下载 URL、固定版本、文件 SHA256：[social-intake-manifest.json](social-intake-manifest.json)。原始数据仅在 Git 忽略的 `output/social-motion-intake/`，未加入产品素材包。恢复命令 `pnpm exec node art/chibi/download-social-intake.mjs`，验证并重建目录 `pnpm exec node art/chibi/catalog-social-intake.mjs`。脚本不购买素材，不操作登录；现有正确文件会按哈希跳过。

实际验证：180 VRMA / 106 BVH 的完整解析、SHA256、轨道、关键帧有限数值与时长全部通过；浏览器逐个载入 234 项并采样 10%/50%/90% 姿态，通过播放/暂停/重播/终点/循环、搜索、收藏恢复、导出、快速切换和 390px 手机宽度检查，无 page/console error。桌面、手机、VRMA、双人及技能脚本截图已查看。数值检查不替代用户动作观感选择。

**真实下载阻塞**：pH 摸头、Scrapfactory 摸头、Andall 1/2/3、Sachi 完整包、rerofumi 完整包的七个免费端点均跳到 BOOTH 登录 HTML；没有将 HTML 当素材保存。VRCMods Hug Emote 需要验证码，未取得。端点与结果保存在本地 `booth-download-status.json` / `pending-downloads.json`，挑选页有原页链接。不能把“未确认公开分发许可”当作不下载本地审片的理由；本次阻塞来自实际登录/验证码。没有购买付费包。拥抱、摸头和摸脸仍未补齐现成配对素材，已撤下的程序拥抱不恢复。

## 用户选定原片与 VRM 方向复查（2026-10-02）

用户明确认可原片页 **01 单手搭肩、02 双手扶肩、03 单人拳击**。对应 22_07/23_07、22_05/23_05、13_17；后续适配以这三项为已选源，不再要求重新选源。认可的是原片，不是尚未完成的小人重定向或高矮组合。

按用户建议扩大到 VRM / VRMA / VRChat 生态，查得：

| 来源 | 已核实内容 | 对本轮任务的意义 |
| --- | --- | --- |
| [Sachi VRMA 1](https://booth.pm/en/items/6412084) | 作者明确 CC0，包含手工及捕捉后修正的 VRMA | 项目之前的轻轻待机已经来自这里；不是新找到的成对拥抱包，不能重复算新增成果 |
| [rerofumi VRMA 短动作包](https://booth.pm/ja/items/5527394) | 8 种单人短动作，VRMA 和 Unity Humanoid 两种格式，CC0；含 `007_gekirei` 鼓励和 `004_hello_1` 等待/招呼 | 可补非接触社交手势；目录没有承诺摸头或成对拥抱，未把鼓励直接当作拍肩 |
| [Hanami / Overte](https://github.com/Undi95/Hanami) | 具有大量 VRMA 转换片段，素材来源各自授权；项目已保留 Overte 固定转换版本与 NOTICE | 可继续复用待机/手势/起停类；本轮未确认所需成对亲密互动文件 |
| [Andall 双人套装 1](https://booth.pm/ja/items/5447815)、[2](https://booth.pm/ja/items/5452069)、[3](https://booth.pm/ja/items/5467632) | 免费 Unitypackage，作者将后两套描述为情侣/情人节向；允许改动，禁止原始或修改后数据再分发 | 明确的双人候选，但非原生 VRMA；未下载、未确认完整运动还是持有姿势，不能直接放进公开仓库 |
| [VRCMods Hug Emote](https://vrcmods.com/item?id=8848) | 作者上传的免费 Unitypackage，描述为抱人动画 | 未确认 A/B 配套、完整时序及再分发许可，未引入 |
| [YUI motion catalog](https://yw0nam.github.io/YUI/reference/motions) | `head_pat` 实为 `idle_10.vrma` 的被摸头反应循环 | 不是给另一角色摸头的手臂动作，不用于填补本轮缺口 |
| [Rexclaw](https://github.com/Codemarchant/rexclaw) | 支持主角/搭档 VRMA 同步播放及各自位置/旋转；说明中以拥抱举例 | 属于播放机制参考；未确认其公开资源中有可直接取用的成对拥抱文件 |

**更明确的成对拥抱商品线索**：[RamsterZ Couples Anim Pack](https://www.fab.com/listings/d50b6dd3-2760-464d-b790-5fc480935fa7) 列有成对拥抱等互动；[作者 FBX 商店页](https://www.ramsterzanimations.com/store-buy/p/couples-anim-pack-fbx-only) 当前标价 US$21.99、86 个手工动画文件（60 站姿/26 坐姿，不等于 86 对），包含根位移。[作者演示](https://www.youtube.com/watch?v=vXsB2Bf6HJE)。未购买或下载。

该作者当前 [EULA](https://www.ramsterzanimations.com/end-user-license-agreement) 限制独立资产分发，并明确限制 AI-specific projects 等用途；鉴于本项目是 AI 角色应用，先排除直接引入，也同步降低此前 RamsterZ 双人攻防候选优先级。购买本身不能解决该条款疑点。

结论：VRMA 格式有现成的通用动作生态，但这次尚未新取得能补齐拥抱、摸头、摸脸的可发布成对动作。VRChat 的触碰表情、手部跟踪与碰撞组件不等于完整双人动作文件。已选 01/02/03 可继续独立适配，不依赖其他素材齐备。

## 本轮状态：撤下失败草稿，先审原片

用户否决了错位、穿模的拥抱。程序生成的拥抱和摸头已从动作实现及试验页移除，旧截图和通过的数值测试不构成视觉验收。小人页现仅保留打招呼、握手和交谈。

新增原片页：`test/fixtures/room3d-social-sources.html`，以下文件已实际取得并可播放；尚未重定向到 Chibi / 二号素体：

| 原片 | 源目录描述 | 实际范围 |
| --- | --- | --- |
| 22_07 / 23_07 | A comforts B, one hand on shoulder | 同一次双人动作，单手搭肩安慰；不能把搭住肩膀直接宣称为重复拍肩 |
| 22_05 / 23_05 | A comforts B, both hands on shoulders | 同一次双人动作，双手扶肩 |
| 13_17 | boxing | 单人练拳，没有对打回应轨 |

- 原数据与 BVH 转换同下方握手来源。文件保存在 `public/room3d/motions/social-source/`，固定镜像版本、下载 URL、SHA256、长度与时长见同目录 `manifest.json`，许可原件一并保留；这些不是 CC0 文件。
- 原片不作骨架重定向、不拉长骨骼、不修改双人的独立站位。只跳过首个校准帧，对整组应用一次共同的缩放和取景平移；根位移、完整时间轴和双方朝向保留。几何骨架不是角色最终外观，也不能证明角色穿衣后不会穿模。
- 使用页面播放、暂停、回放、半速和拖动进度检查源动作。外部商品链接目前只核对了页面描述，未获取商品动作文件或完成其视觉验收。

## 新增候选与排除记录

- 双人攻防：[RamsterZ Hand to Hand Non-Lethal Counters](https://www.fab.com/listings/c0572e05-bed3-4b11-a069-f6e97e60b903)，作者列出攻击/回应成对的格挡、反击、拨挡和闪避；属于手工动画，不是动捕，也不能直接称为完整拳击对打包。[作者演示](https://www.youtube.com/watch?v=MjOporDoY2A)。未购买，未确认本项目所需导出及原文件分发条件。
- 摸脸：尚未找到已确认可取得并适用的抚摸对方面颊动作。摸自己的脸、扇耳光、VRChat 触碰触发表情的组件均不作为替代。
- [MocapOnline cuddle 页面](https://mocaponline.com/blogs/mocap-news/cuddle-romantic-couple-mocap-animations)明确是需求征集，称目前没有专门的拥抱情侣包；不能当作现货。
- [MoCapCentral Greet & Talk](https://mocapcentral.com/products/mocap-studio-series-greet-talk-pack)有同步双人数据，但已查目录未确认拥抱、摸头、摸脸或拍肩，不因名字相似就引入。

## 握手

- 原数据：[CMU Graphics Lab Motion Capture Database](https://mocap.cs.cmu.edu/)，18_01 / 19_01，成对记录的 `walk, shake hands`。
- BVH 转换：Bruce Hahne / cgspeed，2010 MotionBuilder-friendly release v1.1。许可说明原件：[CMU-cgspeed-README.txt](CMU-cgspeed-README.txt)。这是 CMU/cgspeed 的使用条款，**不是 CC0**。
- 固定取得版本：[una-dinosauria/cmu-mocap](https://github.com/una-dinosauria/cmu-mocap/tree/09a07f54f3bbb58797325f009282d0b2048a2871)。
- 原文件：`data/018/18_01.bvh`、`data/019/19_01.bvh`。
- SHA256：18_01 `08a783b18cb63314cefe5ea1d953377d0f02de718de4148067a8febd756bdabf`；19_01 `24770906878edfc86d17417360fa9e22edbf2aa1bc926f19dde1848f0c130304`。
- 致谢：The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.
- 修改：以首帧 T-pose 校准，去掉源人物世界朝向和位移，只提取上身；重定向到本项目骨架、30 Hz 采样。双人共享时钟，保留两条不同轨道；手部 IK 对齐共同接触点，身高改变时使用两人肩高的中间区域，手指为本项目补充（源数据没有指节动捕）。接近、离开及手掌接触修正是项目适配，不是 CMU 原动作的一部分。
- 再生成：将上述两个固定 BVH 放到 `.tmp/social-motion/`，运行 `pnpm exec node art/chibi/import-social-motions.mjs`。脚本校验源哈希。

## 打招呼与交谈

- 打招呼复用用户此前选定的 Meshy 挥手，见 [MESHY-SELECTED-CREDITS.md](MESHY-SELECTED-CREDITS.md)，未新增外部 Meshy 文件。
- 交谈复用已选 Mesh2Motion `Idle_Talking` 上身。固定源、CC0 副本和修改记录见 [SELECTED-CREDITS.md](SELECTED-CREDITS.md#14--交谈手势收腿版-narrow-talk)。两人交替做主要手势，听者减弱幅度；并未生成语音或聊天内容。

## 摸头和拥抱

此前的接触草稿已撤下，**没有已取得并选定的现成成对动作**。原版 Chibi 的悬浮手能简化接触，二号素体仍需处理手臂可达性、头部避让与高矮变体，不能把两类体型混放在同一场景。

- [pH MotionWorks Head Pat Animation](https://booth.pm/en/items/4987740)：作者提供多高度变体，但禁止再分发，本项目未下载或引入。
- [UC-3D](https://ap.isr.uc.pt/datasets/uc-3d/)：有 Hug/Handshake，但非商业限制，未引入。
- [Reallusion Office Work Meeting](https://www.reallusion.com/ContentStore/iClone/pack/Motion-office-work-meeting/default.html)：含 Handshake & Hug，尚未购买或确认适合公开仓库的分发许可。
- [WondAR Walk, Greeting and Hug](https://www.fab.com/listings/1a5bd063-93fd-4db6-a468-316b709dfd56)：9 秒动捕候选商品，页面未确认是否提供完整双方 A/B 轨。未购买、未下载、未做视觉适配。

## 身高差的参考与取舍

[Paralives 官方开发记录](https://www.paralives.com/development)说明按身高选择动画变体，并调整行走速度；这不能推断其拥抱内部算法。[VRChat 体型缩放文档](https://creators.vrchat.com/avatars/avatar-scaling/)说明缩放及眼高测量。本项目保留用户设定的身高差，不采用统一眼高。

拟采用现成成对动作、两位居民共同的互动时钟和世界坐标接触目标；差异较大时需要姿势变体。接触目标应来自实际骨架/几何，不修改骨长。先审源片的完整运动及相对站位，再做同高适配，最后检查高矮组合；摸头与拥抱尚未实现这套流程。
