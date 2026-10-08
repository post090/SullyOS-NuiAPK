import { describe, it, expect } from 'vitest';
import { characterRemark, chatCharacterDisplayName } from './characterRemark';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ChatHeaderShell from '../components/chat/ChatHeaderShell';

describe('chat-only character remark', () => {
    it('uses a remark only when opted in and preserves identity', () => {
        const character = { name: '真实名称', description: '我的备注', chatShowRemark: true };
        expect(chatCharacterDisplayName(character)).toBe('我的备注');
        expect(character.name).toBe('真实名称');
        expect(chatCharacterDisplayName({ ...character, chatShowRemark: false })).toBe('真实名称');
    });
    it('falls back for empty remarks and legacy placeholder values', () => {
        for (const description of ['', '   ', '点击编辑设定...', '点击编辑设定…']) {
            expect(characterRemark(description)).toBe('');
            expect(chatCharacterDisplayName({ name: '真实名称', description, chatShowRemark: true })).toBe('真实名称');
        }
    });
    it.each(['left', 'center'] as const)('the actual chat shell displays the opted-in remark with %s alignment', headerAlign => {
        const props = {selectionMode: false, selectedCount: 0, isTyping: false, isSummarizing: false,
            lastTokenUsage: null, onCancelSelection: () => {}, onClose: () => {}, onTriggerAI: () => {}, onShowCharsPanel: () => {}, headerAlign};
        const character = {id: 'remark', name: '真实名称', avatar: '', description: '我的备注', chatShowRemark: true};
        const title = (activeCharacter: typeof character | {id: string; name: string; avatar: string}) => {
            const html = renderToStaticMarkup(React.createElement(ChatHeaderShell, {...props, activeCharacter}));
            return html.match(/class="sully-chat-name[^\"]*">([^<]+)</)?.[1];
        };
        expect(title(character)).toBe('我的备注');
        expect(title({...character, chatShowRemark: false})).toBe('真实名称');
        expect(title({...character, description: '  '})).toBe('真实名称');
        expect(title({id: 'group', name: '群聊名称', avatar: ''})).toBe('群聊名称');
        expect(character.name).toBe('真实名称');
    });
});
