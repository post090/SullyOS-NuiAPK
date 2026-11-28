import type { APIConfig, CharacterProfile, UserProfile } from '../../types';
import { resolveDialogueApi } from '../characterApi';
import { ContextBuilder } from '../context';
import { normalizeLlmBaseUrl } from '../llmEndpoint';
import { injectMemoryPalace } from '../memoryPalace/pipeline';
import { extractContent, extractJson, safeFetchJson } from '../safeApi';
import { invitationText, parseInvitationReply, voyageMoods, type TravelInvitation } from './letter';
import { listInvitations, saveInvitationReply } from './invitations';
import { resolveCharacterUser } from '../userPersona';
import { SESSION_SPACE_ID } from '../userSpaces';

export async function requestInvitationReply(letter: TravelInvitation, actor: CharacterProfile, user: UserProfile, config: APIConfig, signal: AbortSignal) {
    const generate = async () => {
        const saved = (await listInvitations()).find(item => item.id === letter.id && item.charId === actor.id);
        if (!saved) throw new Error('找不到这封邀请。');
        if (saved.reply && (saved.reply.decision !== 'later' || letter.reply?.at !== saved.reply.at)) return saved;
        const api = resolveDialogueApi(config, actor);
        if (!api.baseUrl || !api.model) throw new Error('请先配置角色或全局对话 API。邀请已送达。');
        const char = { ...actor };
        const prompt = invitationText(saved.occasion, saved.note) + (saved.reply ? '\n\n你先前说：' + saved.reply.text + '\n对方现在想听听你新的想法。' : '');
        await injectMemoryPalace(char, undefined, prompt, resolveCharacterUser(user, char).name);
        const messages = await ContextBuilder.buildCharacterRequest({
            char, user, instructions: '你收到对方亲自送来的虚拟旅行邀请。按自己的意愿，用平时私聊的口吻回一封短笺。可以接受、晚些再决定或婉拒。可以提想去的方向或请假的打算。只发生了送邀请这件事，尚未确定行程、请假或出发。只输出 JSON，对象内 decision 是 accept、later、decline 之一，text 是你写给对方的回信。'
                + '如果想在信上贴一张表达此刻心情的贴纸，可在 moodSticker 填入' + voyageMoods.join('、') + '之一，也可以省略。'
        }, [{ role: 'user', content: prompt }]);
        const data = await safeFetchJson(normalizeLlmBaseUrl(api.baseUrl, api.apiType) + '/chat/completions', {
            method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (api.apiKey || 'sk-none') },
            body: JSON.stringify({ model: api.model, messages, stream: api.stream ?? false, max_tokens: api.maxTokens ?? 1200 })
        }, 0, 0, { appId: 'voyage', appName: '旅迹', purpose: '旅行邀请回信', charId: actor.id, charName: actor.name });
        signal.throwIfAborted();
        return saveInvitationReply(saved.id, actor.id, parseInvitationReply(extractJson(extractContent(data), { silent: true })), saved.reply?.at);
    };
    return navigator.locks ? navigator.locks.request(SESSION_SPACE_ID + '/voyage-reply/' + letter.id, { signal }, generate) : generate();
}
