// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ChatMessage from '../../components/chat/MessageItem';
import type { Message, ChatTheme } from '../../types';
import { invitationText } from './letter';

it('opens only the original invitation from the recipient chat, preserving ordinary replies and selection', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    const root = createRoot(host);
    const open = vi.fn();
    const bubble = { textColor:'#222222', backgroundColor:'#ffffff', borderRadius:16, opacity:1 };
    const theme: ChatTheme = { id:'test',name:'测试',type:'preset', user:bubble,ai:bubble };
    const msg: Message = {
        id:1,charId:'test-recipient',role:'user',type:'text',timestamp:1,content:invitationText('birthday','请选自己想去的地方。'),
        metadata:{voyageInvitationId:'test-letter',voyageOccasion:'birthday'}
    };
    const render = (message: Message, selectionMode = false) => act(async () => {
        root.render(React.createElement(ChatMessage, {
            msg:message, isFirstInGroup:true,isLastInGroup:true,activeTheme:theme,charAvatar:'',charName:'角色',userAvatar:'',
            onLongPress:vi.fn(),onReply:vi.fn(),selectionMode,isSelected:false,onToggleSelect:vi.fn(),onOpenVoyageInvitation:open
        }));
    });
    try {
        await render(msg);
        const find = () => host.querySelector<HTMLButtonElement>('button[aria-label="查看生日旅行邀请"]');
        expect(find()?.textContent).toContain('请选自己想去的地方。');
        expect(find()?.textContent).not.toContain('[旅迹');
        find()!.click();
        expect(open).toHaveBeenCalledWith('test-letter','test-recipient');
        await render({ ...msg, content: msg.content.replace('[旅迹 ', '[旅迹 · ') });
        expect(find()?.textContent).toContain('请选自己想去的地方。');
        expect(find()?.textContent).not.toContain('[旅迹');
        await render(msg,true); expect(find()?.disabled).toBe(true);
        await render({...msg,role:'assistant',content:'我想去看看。'});
        expect(find()).toBeNull(); expect(host.textContent).toContain('我想去看看。');
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
