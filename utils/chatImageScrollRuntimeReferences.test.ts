import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat image bottom anchoring wiring', () => {
  it('eagerly decodes the latest image and reports its final layout', () => {
    const source = readFileSync(path.resolve(__dirname, '../components/chat/MessageItem.tsx'), 'utf8');

    const imageSource = readFileSync(path.resolve(__dirname, '../components/chat/ChatImage.tsx'), 'utf8');
    expect(source).toContain('eager={isLatestMessage}');
    expect(imageSource).toContain("loading={eager ? 'eager' : 'lazy'}");
    expect(imageSource).toContain('onLoad={onLoad}');
    expect(source).toContain('onLoad={() => onMediaLoad?.(m.id)}');
    expect(source).toContain('prev.isLatestMessage === next.isLatestMessage');
  });

  it('re-anchors only while the user is still following the newest message', () => {
    const source = readFileSync(path.resolve(__dirname, '../apps/Chat.tsx'), 'utf8');

    expect(source).toContain('pendingMediaAutoScrollIdRef.current = currentLastId');
    expect(source).toContain('if (distanceFromBottom > 96) pendingMediaAutoScrollIdRef.current = null');
    expect(source).toContain('pendingMediaAutoScrollIdRef.current !== messageId');
    // fork 的阅读位置快照与 upstream 的滚动处理在同一个 onScroll 里都要跑，
    // 锚点钉住两个处理器的接线，缺一个都算回归。
    expect(source).toContain('onScroll={() => { handleScrollSnapshot(); handleChatScroll(); }}');
    expect(source).toContain('onMediaLoad={handleMessageMediaLoad}');
  });
});
