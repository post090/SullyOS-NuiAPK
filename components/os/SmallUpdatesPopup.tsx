import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { trackEvent } from '../../utils/analytics';
import './SmallUpdatesPopup.css';

export const SMALL_UPDATES_KEY = 'sullyos_update_2026_09_small_updates_seen';
const CHANGELOG = 'changelog-2026-09-small-updates';
const TITLES = ['TO 的近期更新', '把 TA 拍进生活里', '上下文，哪里变多了？'];
const PHOTOS = [
    { src: 'camera-snow.webp', label: '雪山 · 晴天' },
    { src: 'camera-neon.webp', label: '街景 · 霓虹' },
];

/** 独立已读标记；切页和看图不算读完，明确关闭后才推进更新队列。 */
export default function SmallUpdatesPopup({ onDone }: { onDone: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(0);
    const [photo, setPhoto] = useState<number | null>(null);
    useEffect(() => {
        dialog.current?.showModal();
        trackEvent('弹出版本更新提醒', { 版本: CHANGELOG });
        return () => dialog.current?.close();
    }, []);
    useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [page, photo]);
    const close = () => {
        try { localStorage.setItem(SMALL_UPDATES_KEY, '1'); } catch { /* 不阻断关闭 */ }
        trackEvent('跳过本次更新说明', { 版本: CHANGELOG });
        onDone();
    };
    const imageUrl = (file: string) => `${import.meta.env.BASE_URL}assets/updates/2026-09/${file}`;

    return <dialog ref={dialog} className="small-updates" aria-labelledby="small-updates-title"
        onCancel={event => { event.preventDefault(); photo === null ? close() : setPhoto(null); }}>
        <header className="small-updates-header">
            <span>糯米机 · 近期小更新</span>
            <button type="button" aria-label={photo === null ? '关闭更新说明' : '返回更新说明'} onClick={() => photo === null ? close() : setPhoto(null)}><X size={20} /></button>
        </header>
        <div ref={content} className="small-updates-body">
            <p className="small-updates-eyebrow">{photo === null ? ['01 / 主动消息与修复', '02 / 聊天相机', '03 / 神经链接'][page] : '相机效果对比'}</p>
            <h2 id="small-updates-title">{photo === null ? TITLES[page] : PHOTOS[photo].label}</h2>
            {photo !== null ? <>
                <p>左右滑动，查看原图、溶图和 CCD 的细节。</p>
                <div className="small-updates-zoom" tabIndex={0} aria-label="可横向滚动的相机对比图"><img src={imageUrl(PHOTOS[photo].src)} alt={`${PHOTOS[photo].label}：原图贴入、溶图、溶图加 CCD 三种效果`} /></div>
            </> : page === 0 ? <>
                <p>感谢 <a href="https://github.com/Tosd0" target="_blank" rel="noopener noreferrer">TO（@Tosd0）</a> 带来的这些更新。</p>
                <section><h3>主动消息 2.0，更好掌握节奏</h3>
                    <p>可以调整连续主动次数、间隔、每日上限、未回复时暂停重复任务，以及任务数量等。这里的「次」指一次主动联系，与一次发出几个气泡无关。</p>
                    <div className="small-updates-note">聊天设置 → 主动消息 2.0 → 主动频率 → 调整</div>
                    <p>SAR 模块生效期间的聊天也支持即时对话；通过一键部署安装的 Worker 支持自动更新。</p>
                    <p className="small-updates-caption">请让 Worker 更新到新版。手动部署仍需手动更新；若云端模型与本地选择不一致，也可先手动点一次更新 Worker。</p>
                </section>
                <section><h3>顺手修好了这些</h3><ul>
                    <li>本地聊天调用排程工具，不再出现空回复。</li>
                    <li>选完模型直接生效，并修复部分云端与本地模型选择不一致的情况。</li>
                    <li>未选角色时，进入记忆宫殿全局配置不再崩溃。</li>
                    <li>MiniMax 开发代理支持按地区分流。</li>
                </ul></section>
            </> : page === 1 ? <>
                <p>聊天里的「＋ → 相册 → 拍照」，可以把角色立绘、Live2D 快照和贴纸放进照片，再搭配溶图、滤镜、CCD 效果与相框。</p>
                <div className="small-updates-photos">{PHOTOS.map((item, index) => <button type="button" key={item.src} onClick={() => setPhoto(index)} aria-label={`放大查看${item.label}`}>
                    <img src={imageUrl(item.src)} alt={`${item.label}：原图、溶图与 CCD 效果对比`} loading="lazy" width={1480} height={700} />
                    <span>{item.label}<span><MagnifyingGlassPlus size={15} /> 放大对比</span></span>
                </button>)}</div>
                <section><h3>喜欢这张照片，记得主动保存</h3>
                    <p>拍照和编辑中的图片只是临时内容。确认发送后会留在糯米机的聊天与相册里，<strong>不会自动存进手机系统相册</strong>。想留在手机里，请打开大图手动保存。</p>
                </section>
                <p className="small-updates-caption">背景照片、角色立绘与 Live2D 模型请遵守各自作者的授权；示例展示不代表附带素材使用授权。<a href={`${import.meta.env.BASE_URL}licenses/camera.html`} target="_blank" rel="noopener noreferrer">查看内置素材与组件许可</a></p>
            </> : <>
                <p>神经链接新增「角色统计」，排查上下文太长时，可以先来看看是哪部分占得多。</p>
                <div className="small-updates-note">神经链接 → 选择角色 → 角色统计</div>
                <section><h3>消息、记忆、世界书，分开看</h3>
                    <p>查看角色当前可读范围的正文字符数、内容构成和 Token 估算，也能检查上下文水位线与记忆宫殿状态。</p>
                    <p>如果最近突然变得很长，可以从聊天记录、记忆或世界书入手排查。查看统计本身不会调用模型。</p>
                </section>
                <section><h3>估算和实际请求有区别</h3>
                    <p>这里是本地可读内容的快照，不等于每个 App 实际发出的完整请求；App 专属规则、图片等也可能占用上下文。</p>
                    <p>Token 只是粗略估算，实际用量以 API 返回的 usage 为准。</p>
                </section>
            </>}
        </div>
        <footer className="small-updates-footer">
            {photo !== null ? <button type="button" className="small-updates-primary" onClick={() => setPhoto(null)}><ArrowLeft size={16} /> 返回说明</button> : <>
                <div className="small-updates-pages" aria-label={`第 ${page + 1} 页，共 3 页`}>{TITLES.map((title, index) => <button key={title} type="button" aria-label={`查看${title}`} aria-current={page === index ? 'step' : undefined} onClick={() => setPage(index)} />)}</div>
                <div className="small-updates-actions">
                    <button type="button" onClick={() => page === 0 ? close() : setPage(page - 1)}>{page === 0 ? '先收下' : '上一页'}</button>
                    <button type="button" className="small-updates-primary" autoFocus onClick={() => page === 2 ? close() : setPage(page + 1)}>{page === 2 ? '知道啦' : '下一页'}{page < 2 && <ArrowRight size={16} />}</button>
                </div>
            </>}
        </footer>
    </dialog>;
}
