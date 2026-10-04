import { describe, expect, it } from 'vitest';
import { ChatPrompts } from './chatPrompts';
import { normalizeMessageContent } from './messageFormat';
import { loadChatInputPreferences, saveChatInputPreferences, normalizeChatInputPreferences } from './chatInputPreferences';

describe('share links reaching the actual model request', () => {
  it.each(['webpage_card', 'xhs_card'])('%s keeps the original short URL and user instruction', type => {
    const text = '用我的 MCP 看看这个 https://v.douyin.com/abc/ 然后解释歌词';
    const message = { id: 1, charId: 'c', role: 'user', type, content: '标题', timestamp: 1,
      metadata: { originalShareText: text, originalShareUrl: 'https://v.douyin.com/abc/',
        webpage: { title: '标题', url: 'https://final.example/video', content: '抓取正文' },
        xhsNote: { title: '标题', noteId: 'note-id', desc: '抓取正文' } } } as any;
    expect(normalizeMessageContent(message, '角色', '小林')).toContain(text);
    const { apiMessages } = ChatPrompts.buildMessageHistory([message], 50, { id: 'c', name: '角色' } as any, { name: '小林' } as any, []);
    expect(apiMessages.find(m => m.role === 'user')?.content).toContain(text);
  });
  it('old webpage cards and XHS cards retain usable links without source-text migration', () => {
    for (const metadata of [
      { webpage: { title: '网易云', url: 'https://music.163.com/song?id=1', finalUrl: 'https://music.163.com/#/song?id=1' } },
      { xhsNote: { title: '笔记', noteId: 'abc', xsecToken: 'signed token' } },
    ]) {
      const type = 'webpage' in metadata ? 'webpage_card' : 'xhs_card';
      const msg = { id: 1, charId: 'c', role: 'user', type, content: '标题', timestamp: 1, metadata } as any;
      const { apiMessages } = ChatPrompts.buildMessageHistory([msg], 50, { id: 'c', name: '角色' } as any, { name: '小林' } as any, []);
      expect(JSON.stringify(apiMessages)).toContain(type === 'webpage_card' ? 'music.163.com' : 'xiaohongshu.com/explore/abc?xsec_token=signed%20token');
    }
  });
  it('general and XHS toggles are independent and survive export/import normalization', () => {
    const prefs = normalizeChatInputPreferences({ linkCards: false, xhsCards: true, linkCardNoticeSeen: true });
    saveChatInputPreferences(prefs);
    expect(loadChatInputPreferences()).toEqual(prefs);
    expect(normalizeChatInputPreferences(JSON.parse(JSON.stringify(prefs)))).toEqual(prefs);
    expect(normalizeChatInputPreferences({})).toMatchObject({ linkCards: true, xhsCards: true });
  });
});

it('keeps assistant XHS attribution, engagement and comments without a fetched body',()=>{
 const msg={id:1,charId:'c',role:'assistant',type:'xhs_card',content:'标题',timestamp:1,metadata:{xhsNote:{title:'标题',noteId:'abc',likes:12,collects:3,comments:[{author:'路人',content:'好看'}]}}} as any;
 const {apiMessages}=ChatPrompts.buildMessageHistory([msg],50,{id:'c',name:'阿蓝'} as any,{name:'小林'} as any,[]);
 const text=JSON.stringify(apiMessages);
 expect(text).toContain('阿蓝分享');expect(text).not.toContain('小林分享');expect(text).toContain('12赞');expect(text).toContain('3收藏');expect(text).toContain('好看');
});
