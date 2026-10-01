# ACID ORBIT · 酸性星轨

## 当前版本：ACID ORBIT · 酸性星轨（已恢复）

已恢复到深色轨道通讯舱版本，保留头像顶边对齐和日程回执可读性修复。构建源为 acid-orbit.css，导入文件为 acid-orbit.sully.json。

完整 SullyOS 聊天装扮。第二版为非对称轨道通讯舱：大字标与轨道徽记、镂空头像框、银紫折角气泡、票券式转账卡与背景轨道线。可见头像与气泡/转账/独立语音条顶边对齐。

## 使用

聊天「＋」→「聊天装扮」→ 文件导入，选择 `acid-orbit.sully.json`，查看内容并应用到目标角色。

整套包含布局、双方气泡、CSS 背景、心象与白框 CSS。无需外链图片或字体，提示音保持原设置。也可将 `acid-orbit.css` 的内容复制到白框 CSS 编辑器，但推荐 JSON 导入以获得配套布局和气泡配置。

覆盖顶栏、情绪标签、头像星芒、气泡、语音播放/加载/字幕、转账主卡/三种状态/回执/详情、心象折叠/展开、文件、系统提示、日程提示、输入栏、功能面板以及所有开放的 App 卡片外壳。HTML 卡片只改变外框，不进入 iframe 改写内容。卡片内部图片、图表和自带装饰继续保留；转账金额单位由应用决定。

## 预览与维护

`preview.html` 使用项目真实消息组件生成的静态样例，支持逐项切换；没有真实聊天、支付或消息发送。通过本地开发服务器访问 `/art/acid-orbit/preview.html`。

修改 CSS 后运行 `node art/acid-orbit/build.mjs` 重新生成导入文件；运行 `node art/acid-orbit/build-preview.mjs` 更新预览脚本。预览使用打包后的脚本，避免开发环境大量图标模块拖慢首次加载。

最新样式按星云参考图调整：去掉聊天顶栏英文标题及小字，恢复圆头像、圆润玻璃卡片与胶囊输入框；日程回执可读性与头像对齐修复继续保留。

酸性哥特花边：输入栏上缘新增 24px 黑紫尖拱蕾丝，使用 Lucide flower-2 花芯（ISC；许可内嵌于 CSS/JSON，另见 LUCIDE-LICENSE.txt），尖拱与网边为自绘。SVG 已内嵌，不依赖 CDN。修改花边运行 node art/acid-orbit/build-lace.mjs，再运行原有两项构建。顶部已收为约 80px 高的小状态栏，两侧留白。


当前蕾丝：用户提供的 scallop2.svg（https://freesvg.org/scallop2，CC0）。保留原件 scallop2-source.svg；构建只提取静态 path、裁掉顶部部分实心区域并改为灰银紫色。上下花边统一 20px，同一素材镜像排列；SVG 内嵌在 CSS 和导入 JSON 内，无外链依赖。
