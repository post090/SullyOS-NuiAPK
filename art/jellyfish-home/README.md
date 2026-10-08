# 粉紫水母小屋

这是一套原创 Blender 模型与独立实时预览。房屋占地为 6 × 5.1，墙高约 4.7；1:1 指完整房屋画面的比例。没有人物、文字、按钮或游戏面板。

## 文件

生成文件位于 `output/jellyfish-home/`：

- `jellyfish-home.blend`：可编辑源场景，按房屋、水族窗、阁楼、书桌、客厅等分 Collection。重复几何使用 linked mesh；材质与纹理已打包。
- `jellyfish-home.glb`：实时模型；静态物件按材质合批，10 只水母保留浮动动画与独立触手组。
- `preview-square.png`：Blender Cycles 预览。此图是离线材质与造型检查，不是实时帧。
- `realtime-square.png`、`realtime-portrait.png`、`realtime-mobile.png`：实际浏览器 WebGL 截图。
- `metrics.json`、`browser-qa.json`：模型规模、浏览器加载、动画与绘制调用检查。
- `site/`：可独立托管的预览，Three.js 已打包，无 CDN 依赖。

源代码位于本目录：`build.py` 生成场景；`viewer.js` 配置实时材质、光照、镜头、动画；`server.mjs` 为只读本地预览服务器。

## 打开与重建

在仓库根目录启动实时预览：

```powershell
node art/jellyfish-home/server.mjs
```

访问 `http://127.0.0.1:4178/`。可以小范围拖动观察、缩放；F 切换全屏。画面本身没有 UI。

重建模型和 Blender 预览：

```powershell
& 'D:/Program Files/Blender Foundation/Blender 4.2/blender.exe' --background --python art/jellyfish-home/build.py
```

只重建模型时在命令末尾加 `-- --no-render`。重新打包独立网页：

```powershell
node art/jellyfish-home/package.mjs
```

## 美术与动画

奶油色厚墙和地台，左侧阁楼及宽踏步，床下书桌与三层书柜；右后方六只水母的大观景窗，左侧两只水母的舷窗，右前方两只水母的小缸。沙发、云朵地毯、花瓣矮凳和圆茶几形成前景。六盆植物、七件墙面装饰、三种水母灯构成次级细节。

被子与沙发毯使用有起伏和垂坠的网格；抱枕有体积和包边；水母伞体有弧形分瓣纹路。两张 256 × 256 纹理负责格纹和水族渐变，没有依赖复杂程序材质或外部素材。

GLB 自带循环浮动动画。预览用 `extras` 中的 `floatAmplitude`、`floatSpeed` 和 `phase` 驱动缓慢漂浮，同时让触手组轻微摆动。接入游戏时，选择 GLB AnimationMixer 或预览中的程序动画其中一种，避免叠加。

## 实时取舍

- 桌面档：柔化阴影、GTAO 接触阴影、轻微高光 bloom。
- 触屏默认移动档：1.5 倍像素比上限、1024 阴影贴图，关闭 GTAO 和 bloom；保留水母动画。可用 `?quality=mobile` 检查。
- 水族空间采用浅层几何、渐变背板及薄玻璃，不做水体模拟和实时折射。
- 静态物体在导出的 GLB 中按材质合并；精细编辑使用未合并的 `.blend`。
- 方形预览完整保留房屋轮廓。更窄的手机画面优先完整显示房屋，房屋放在中央偏上；其高度占比随屏幕宽高比变化，不通过裁切或拉伸强行填满 65%–75%。
- 浏览器 QA 可验证加载、透明材质、动画和不同画幅；桌面浏览器的移动尺寸截图不等于真实手机帧率测试。尚未接入 SullyOS 正式界面，也未在实体手机测量帧率。

预览服务器仅绑定本机回环地址，仅暴露该美术目录、输出文件和 Three.js 文件。未更改现有小屋或用户数据。
