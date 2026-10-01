// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { beautyPreviewDocument } from './beautyPreview';

describe('美化预览隔离', () => {
  it('预览文档禁用脚本、提交和外部连接', () => {
    const html = beautyPreviewDocument({ format: 'sullyos-chat-decoration', version: 1, name: '样例', parts: { css: '</style><script>bad()</script>', bubbles: { customCss: '</style><img src=x onerror=bad()>' } } });
    expect(html).toContain("script-src 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).not.toContain('<script>');
    expect(html.match(/<\/style>/g)).toHaveLength(1);
  });
  it('只使用示例文字，不把角色或聊天字段放进预览', () => {
    const html = beautyPreviewDocument({ format: 'sullyos-chat-decoration', version: 1, name: '样例', parts: { css: '' }, messages: [{ text: 'secret-message' }], character: { name: 'secret-character' } });
    expect(html).not.toContain('secret-message'); expect(html).not.toContain('secret-character');
    expect(html).toContain('欢迎回家');
  });
  it('桌面装饰不能注入 HTML', () => {
    const html = beautyPreviewDocument({ type: 'sully_appearance_preset', version: 1, name: '样例', theme: { desktopDecorations: [{ content: '<script>bad()', x: NaN }] } });
    expect(html).not.toContain('<script>'); expect(html).not.toContain('NaN');
  });
  it('按 App 对应图标和中文名称，包括彼方与热点', () => {
    const html = beautyPreviewDocument({type:'sully_appearance_preset',version:1,name:'SULLY',theme:{},customIcons:{vrworld:'/planet.webp',hot_news:'/news.webp',bank:'/bank.webp'}});
    expect(html).toContain('/planet.webp'); expect(html).toContain('/news.webp');
    expect(html).toContain('<small>彼方</small>'); expect(html).toContain('<small>热点</small>');
    expect(html).not.toContain('/bank.webp');
  });
});
