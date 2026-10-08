# 服装制作检查点

本目录保存开衫、男女水手服试穿及男款贴图画室；尚未接入正式衣橱。
已打包 `app.js` 与 `paint.js`，打开预览不需要重新编译。

在本目录启动静态服务，例如 `python -m http.server 5197`，然后打开：

- `http://127.0.0.1:5197/?quality=detail`：已确认开衫。
- `http://127.0.0.1:5197/?quality=sailor-school`：用户手绘贴图男款。
- `http://127.0.0.1:5197/?quality=sailor-girl`：女款，含薄内衬、贴体袜壳及修正鞋。
- `http://127.0.0.1:5197/paint.html?texture=user`：保留用户 UV v1 的画室。

制作脚本、母版与独立部件位于相邻 `sailor-school`、`sailor-girl` 目录。
女款最新母版为 `sailor-girl-surface-socks.blend`，制作顺序 `fit.py` → `refine-fit.py` → `fit-shoes-socks.py`。
脚本目前保留本机 Blender 和工作目录路径；跨机器重建前需修改路径。原始模型已存入 source-1.blend。
后领已留出抬臂袖根的空间；验证默认/T/A/垂手正侧背及脚部近景。大幅坐姿的裙子适配仍需后续处理。
已有打包脚本可直接运行；重新打包依赖工作区对应的 Three.js、姿态/动作模块。
