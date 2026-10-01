import { validateBeautyPackage, type BeautyShare } from './beautyShareContract';
import { canvasToPng } from './shareCardCanvas';

export const PREVIEW_WIDTH = 360;
export const PREVIEW_HEIGHT = 600;
export const escapePreviewText = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const cssText = (value: unknown) => String(value || '').replace(/</g, '\\3c ').replace(/\u0000/g, '');
const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const resource = (value: unknown) => typeof value === 'string' && /^(https?:\/\/|data:image\/|blob:|\/(?!\/))/.test(value) ? value : '';
const image = (value: unknown, className: string, style = '') => resource(value) ? `<img alt="" class="${className}" src="${escapePreviewText(value)}" style="${escapePreviewText(style)}">` : '';
const background = (value: unknown, fallback: string) => resource(value) ? `url(${JSON.stringify(value)}) center/cover no-repeat` : typeof value === 'string' && /^(linear|radial|conic)-gradient\(/.test(value) ? value : fallback;

/** Script-free sample markup, mounted by the caller inside an isolated Shadow DOM. */
export function beautyPreviewDocument(value: unknown): string {
  const { kind, data } = validateBeautyPackage(value);
  let content: string; let extra = ''; let baseBackground = '#ede9e4';
  if (kind === 'appearance') {
    const t = data.theme;
    const hue = number(t.hue, 265, 0, 360), saturation = number(t.saturation, 30, 0, 100), lightness = number(t.lightness, 75, 0, 100);
    baseBackground = background(t.wallpaper, `linear-gradient(145deg,hsl(${hue},${saturation}%,${lightness}%),#f2eee9)`);
    const apps = [['chat', '聊天'], ['appearance', '外观'], ['music', '音乐'], ['journal', '日记'], ['gallery', '相册'], ['vrworld', '彼方'], ['hot_news', '热点'], ['settings', '设置']];
    const iconMarkup = apps.map(([id, name], i) => `<div class="app"><div class="icon" style="background:hsla(${hue + i * 9},${saturation}%,${lightness}%,.85)">${resource(data.customIcons?.[id]) ? image(data.customIcons[id], 'custom-icon') : `<span>${name[0]}</span>`}</div><small>${escapePreviewText(name)}</small></div>`).join('');
    const stickers = (Array.isArray(t.desktopDecorations) ? t.desktopDecorations : []).slice(0, 30).map((d: any) => {
      const style = `left:${number(d.x, 50, 0, 100)}%;top:${number(d.y, 50, 0, 100)}%;transform:translate(-50%,-50%) rotate(${number(d.rotation, 0, -180, 180)}deg) scale(${number(d.scale, 1, .2, 3)});opacity:${number(d.opacity, 1, 0, 1)}`;
      return resource(d.content) ? image(d.content, 'sticker', style) : `<span class="sticker" style="${escapePreviewText(style)}">${escapePreviewText(String(d.content || '').slice(0, 12))}</span>`;
    }).join('');
    content = `<main class="desktop"><div class="status">09:41 <span>● ▰</span></div><section class="clock"><div>09:41</div><p>美好的一天，从这里开始</p></section><section class="widget"><small>SULLYOS</small><h2>欢迎回家</h2><p>今天也有想珍藏的小事。</p></section><div class="apps">${iconMarkup}</div>${stickers}<div class="dock">◯　✧　♡　▧</div></main>`;
    extra = `.desktop{color:${cssText(t.contentColor || '#333')};font-family:${t.desktopClockStyle === 'serif' ? 'Georgia,serif' : 'system-ui'}}`;
  } else {
    const p = data.parts, l = p.layout || {}, b = p.bubbles || {};
    baseBackground = background(p.background?.image, '#f2efec');
    const avatar = l.chatAvatarShape === 'square' ? '4px' : l.chatAvatarShape === 'rounded' ? '12px' : '50%';
    const bubble = (side: 'user' | 'ai', text: string) => {
      const v = b[side] || {};
      const rounded = number(v.borderRadius, 18, 0, 100);
      const corners = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(key => number(v[key], rounded, 0, 100) + 'px').join(' ');
      const style = `background:${v.backgroundColor || (side === 'user' ? '#d6c8e1' : '#fff')};color:${v.textColor || '#34313a'};border-radius:${corners};opacity:${number(v.opacity, 1, 0, 1)};font-size:${number(l.chatBubbleFontSize, 15, 12, 26)}px`;
      const hide = l.chatAvatarVisibility === 'hide_both' || l.chatAvatarVisibility === (side === 'user' ? 'hide_user' : 'hide_ai');
      return `<div class="sully-chat-message sully-chat-message-${side}">${hide ? '' : `<div class="sully-chat-avatar-wrap" style="border-radius:${avatar}">${side === 'user' ? '我' : '✧'}</div>`}<div class="sully-chat-message-content"><div class="sully-bubble-${side} bubble" style="${escapePreviewText(style)}">${image(v.backgroundImage, 'bubble-background', `opacity:${number(v.backgroundImageOpacity, 1, 0, 1)}`)}<span class="bubble-text">${text}</span>${image(v.decoration, 'bubble-decoration')}</div></div></div>`;
    };
    extra = cssText(p.css) + '\n' + cssText(b.customCss);
    content = `<main class="sully-chat-root"><div class="status">09:41 <span>● ▰</span></div><header class="sully-chat-header">‹ <b>美化预览</b> ···</header><div class="sully-chat-messages"><div class="timestamp">今天 09:41</div>${bubble('ai', '欢迎回家，今天过得怎么样？')}${bubble('user', '发现了一套很喜欢的美化。')}${bubble('ai', '把喜欢的颜色，留在每一天。')}</div><footer class="sully-chat-input-area"><span>＋</span><div class="sully-chat-input">分享一点今天的心情…</div><span>♡</span></footer></main>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https:; img-src data: blob: https: http:; font-src data: https:; base-uri 'none'; form-action 'none'"><style>
*{box-sizing:border-box}html,body{margin:0;width:360px;height:600px;overflow:hidden;font:15px/1.6 system-ui,'Microsoft YaHei',sans-serif}body{background:${cssText(baseBackground)}}main{height:600px;position:relative;overflow:hidden}.status{padding:12px 22px;font-size:12px;font-weight:600}.status span{float:right}.clock{text-align:center;margin:16px 0 25px}.clock div{font-size:58px;line-height:1.15}.clock p{font:11px system-ui}.widget{margin:0 25px 27px;padding:17px 22px;border-radius:24px;background:#ffffffb8}.widget small{font-size:9px;letter-spacing:3px}.widget h2{margin:5px 0;font-size:22px}.widget p{font-size:11px;margin:0}.apps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 14px;padding:0 22px}.app{text-align:center}.icon{width:54px;height:54px;border-radius:17px;margin:auto;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:25px;color:#fff}.custom-icon{width:100%;height:100%;object-fit:cover}.app small{display:block;margin-top:4px;font-size:10px;max-width:66px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.sticker{position:absolute;width:76px;height:76px;object-fit:contain;font-size:40px;z-index:2}.dock{position:absolute;bottom:20px;left:25px;right:25px;text-align:center;border-radius:25px;background:#ffffffaa;padding:13px;font-size:25px}.sully-chat-header{height:65px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#ffffffbb}.sully-chat-messages{padding-top:25px}.timestamp{text-align:center;font-size:10px;color:#888;margin-bottom:25px}.sully-chat-message{display:flex;gap:9px;align-items:flex-end;margin:24px 16px}.sully-chat-message-user{flex-direction:row-reverse}.sully-chat-avatar-wrap{background:#c7bccc;color:#fff;flex-shrink:0;width:34px;height:34px;display:flex;align-items:center;justify-content:center}.sully-chat-message-content{max-width:242px}.bubble{padding:13px 16px;position:relative;isolation:isolate}.bubble-text{position:relative;z-index:1}.bubble-background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:0}.bubble-decoration{position:absolute;width:35px;height:35px;object-fit:contain;bottom:-12px;right:-10px;z-index:2}.sully-chat-input-area{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:12px;padding:19px 15px 30px;background:#ffffffbd}.sully-chat-input{flex:1;background:#fff;border-radius:20px;color:#999;font-size:12px;padding:10px 12px}
${extra}
*{animation:none!important;transition:none!important;pointer-events:none!important}</style></head><body>${content}</body></html>`;
}

/** No embedded preset payload: the picture shares a code, not an unreviewed file. */
export async function beautyPoster(preview: HTMLCanvasElement, share: BeautyShare): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1640;
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('当前设备无法生成预览图');
  ctx.fillStyle = '#f5f2eb'; ctx.fillRect(0, 0, 1080, 1640);
  const text = (value: string, x: number, y: number, size: number, color = '#2f3038') => { ctx.fillStyle = color; ctx.font = `500 ${size}px "PingFang SC","Microsoft YaHei",sans-serif`; ctx.fillText(value, x, y, 940); };
  text('SULLYOS  /  美化分享', 66, 78, 25, '#81758c');
  text(share.metadata.name, 66, 142, 46); text(`作者  ${share.metadata.credit}`, 66, 192, 25, '#69636e');
  const h = 1000, w = preview.width / preview.height * h;
  ctx.drawImage(preview, (1080 - w) / 2, 238, w, h);
  text('预设搭配预览 · 示例内容', 66, 1290, 22, '#81758c');
  text(share.code, 66, 1360, 52);
  text(`${share.metadata.allowRemix ? '允许二改' : '禁止二改'} · ${share.metadata.allowRedistribute ? '允许二次传播' : '禁止二次传播'}`, 66, 1420, 26);
  text(`Repo：${share.metadata.platforms.join(' / ')}`, 66, 1470, 25);
  text('糯米机 → 外观 → 美化分享 → 用码领取', 66, 1538, 27);
  text(`导出版本 ${share.metadata.exportVersion} · 领取前请阅读完整使用规范`, 66, 1590, 21, '#81758c');
  return canvasToPng(canvas);
}
