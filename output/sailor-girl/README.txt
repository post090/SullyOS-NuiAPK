女款短袖水手服与百褶裙 · 本机试穿候选
http://127.0.0.1:5197/?quality=sailor-girl

sailor-girl-top.glb：上衣，2619 三角面。
sailor-girl-skirt.glb：裙子，420 三角面。
sailor-girl-shoes.glb：共用鞋，1164 三角面。
sailor-girl-socks.glb：素体表面偏移袜壳，1156 三角面。
以上均无人体、无骨骼，部件独立。
sailor-girl-fitted.blend：适配当前窄肩素体的蒙皮母版。
source-1.blend：原始导入备份。

纯色试穿，外轮廓优先；无额外减面。裙子当前跟随髋部，非布料模拟。
运行时含覆盖身体的遮挡面处理，后续接入衣橱需保留对应处理。
动作加载检查通过不代表所有坐姿/大幅动作零穿模，仍待版型看样。

最新完整母版：sailor-girl-surface-socks.blend。
制作顺序：fit.py → refine-fit.py → fit-shoes-socks.py。
袜子从当前素体表面复制，沿法线偏移0.008并保留原权重；包含小腿、脚踝和脚背。
鞋面/脚趾/鞋底已重新匹配素体尺寸，鞋袜保持独立。
领口与男款用户贴图一致，短袖已重新对齐，裙内有独立遮挡内衬。
