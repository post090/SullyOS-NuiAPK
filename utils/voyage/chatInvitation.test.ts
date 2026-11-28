// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ChatMessage from '../../components/chat/MessageItem';
import type { Message, ChatTheme } from '../../types';
import { invitationBody, invitationText } from './letter';

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
        expect(find()?.dataset.occasion).toBe('birthday');
        expect(find()?.querySelector('[lang="en"]')?.textContent).toBe('Happy Birthday');
        expect(find()?.querySelector('.voyage-invite-body')?.id).toBe(find()?.getAttribute('aria-describedby'));
        find()!.click();
        expect(open).toHaveBeenCalledWith('test-letter','test-recipient');
        await render({ ...msg, content: msg.content.replace('[旅迹 ', '[旅迹 · ') });
        expect(find()?.textContent).toContain('请选自己想去的地方。');
        expect(find()?.textContent).not.toContain('[旅迹');
        await render(msg,true); expect(find()?.disabled).toBe(true);
        find()!.click();
        expect(open).toHaveBeenCalledTimes(1);
        const note = '给你留了两天。\n\n' + 'A'.repeat(400);
        const gift = { ...msg, id:2, content:invitationText('gift',note), metadata:{voyageInvitationId:'gift'} };
        await render(gift); // Older invitations can lack the occasion field.
        const ticket = () => host.querySelector<HTMLButtonElement>('button[aria-label="查看旅行邀请"]');
        expect(ticket()?.dataset.occasion).toBe('gift');
        expect(ticket()?.querySelector('[lang="en"]')).toBeNull();
        expect(ticket()?.querySelector('.voyage-invite-note')?.textContent).toBe(note);
        expect(ticket()?.querySelector('.voyage-invite-body > span')?.textContent).toBe(invitationBody);
        ticket()!.click();
        expect(open).toHaveBeenLastCalledWith('gift','test-recipient');
        await render({ ...gift, content:'[旅迹 旅行邀请] 早期留言\n\n第二段照旧。' });
        expect(ticket()?.querySelector('.voyage-invite-body')?.textContent).toBe('早期留言\n\n第二段照旧。');
        await render({...msg,role:'assistant',content:'我想去看看。'});
        expect(find()).toBeNull(); expect(host.textContent).toContain('我想去看看。');
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
