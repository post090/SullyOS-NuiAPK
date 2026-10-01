import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SAR_CLUB_STATE,
    SAR_CAIAN_INTRO_DIALOGUE,
    getSARDialogueNode,
    patchSARClubState,
    readSARClubState,
    rewindSARIntro,
    sarRoomView, nextSARRoomView,
    type SARClubState,
} from './vrWorld/sarClub';

const memoryStorage = () => {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
    };
};

describe('SAR 活动室状态', () => {
    it('cycles the four room views, migrates old hidden labels and preserves the NPC preference',()=>{
        const storage=memoryStorage();
        let state=patchSARClubState({npcPreference:'show',labelsHidden:true},storage);
        expect(sarRoomView(readSARClubState(storage))).toBe('text-hidden');
        const seen=[];
        state=patchSARClubState({roomView:'all',labelsHidden:false},storage);
        for(let i=0;i<4;i++){
            const view=nextSARRoomView(sarRoomView(state));
            state=patchSARClubState({roomView:view,labelsHidden:view==='text-hidden'},storage);
            seen.push(sarRoomView(readSARClubState(storage)));
            expect(state.npcPreference).toBe('show');
        }
        expect(seen).toEqual(['names-hidden','text-hidden','characters-hidden','all']);
    });
    it('没有存档时保持未选择，选择 NPC 后仍与见面状态分离', () => {
        const storage = memoryStorage();
        expect(readSARClubState(storage)).toEqual(DEFAULT_SAR_CLUB_STATE);

        let state = patchSARClubState({ npcPreference: 'show', updateSeenVersion: 1 }, storage);
        expect(state.npcPreference).toBe('show');
        expect(state.caianMet).toBe(false);

        state = patchSARClubState({ caianMet: true, introReaction: 'character-card' }, storage);
        expect(readSARClubState(storage)).toMatchObject<SARClubState>({
            version: 1,
            updateSeenVersion: 1,
            npcPreference: 'show',
            caianMet: true,
            introReaction: 'character-card',
        });

        state = patchSARClubState({ npcPreference: 'hide' }, storage);
        expect(state.caianMet).toBe(true);
    });

    it('角色卡说明会根据前置分支选择正确的第一句', () => {
        const mentioned = getSARDialogueNode('about-character-card', { mentionedCharacterCard: true });
        const notMentioned = getSARDialogueNode('about-character-card', { mentionedCharacterCard: false });
        expect(mentioned.lines[0].text).toBe('对！你刚才提到的。');
        expect(notMentioned.lines[0].text).toBe('对！我在这里听说过。');
        expect(mentioned.lines).toHaveLength(notMentioned.lines.length);
    });

    it('艾文拆台时凯恩保留原表情，接下一句才触发尴尬反应',()=>{
        const punchlines=['这里似乎没有仿生人。','然后他就成立了 SAR。','结果是这样。','之一？','你又开始了。','实际上他把这里改造成了 SAR。','还贴了横幅。','这里可以抽卡、钓鱼、买道具给你的朋友们用。'];
        let checked=0;
        for(const id of Object.keys(SAR_CAIAN_INTRO_DIALOGUE)){
            const {lines}=getSARDialogueNode(id,{mentionedCharacterCard:false});
            for(const [index,line] of lines.entries())if(punchlines.includes(line.text)){
                expect(line.speaker).toBe('aiven');
                expect(line.castExpressions?.caian).toBe(lines[index-1].castExpressions?.caian);
                expect(lines[index+1].castExpressions?.caian).toBe('embarrassed');
                checked++;
            }
        }
        expect(checked).toBe(punchlines.length);
        // Simply calling his name is an interruption, before the actual punchline.
        expect(getSARDialogueNode('about-sar',{mentionedCharacterCard:false}).lines[3].castExpressions?.caian).toBe('serious');
    });

    it('双人表情随台词保留，分支切换与条件过滤不会带入上一段情绪',()=>{
        const sad=getSARDialogueNode('about-aster',{mentionedCharacterCard:false});
        expect(sad.lines[0].castExpressions).toEqual({caian:'aboutaster',aiven:'sad'});
        expect(sad.lines[6].castExpressions).toEqual({caian:'shy',aiven:'sad'});
        expect(sad.lines.at(-1)?.castExpressions).toEqual({caian:'embarrassed',aiven:'sad'});
        expect(getSARDialogueNode('about-features',{mentionedCharacterCard:false}).lines[0].castExpressions).toEqual({caian:'happy',aiven:'normal'});
        for(const mentionedCharacterCard of [true,false]){
            const lines=getSARDialogueNode('about-character-card',{mentionedCharacterCard}).lines;
            expect(lines[0].castExpressions).toEqual({caian:'happy',aiven:'normal'});
            expect(lines[4].castExpressions).toEqual({caian:'serious',aiven:'interested'});
        }
        // Later reactions must not mutate earlier, already-resolved frames.
        expect(sad.lines[0].castExpressions).toEqual({caian:'aboutaster',aiven:'sad'});
    });

    it('剧情回档只重置凯恩初见，不重播公告也不改 NPC 偏好', () => {
        const storage = memoryStorage();
        patchSARClubState({
            npcPreference: 'show',
            updateSeenVersion: 1,
            caianMet: true,
            introReaction: 'silent',
        }, storage);

        expect(rewindSARIntro(storage)).toEqual({
            version: 1,
            updateSeenVersion: 1,
            npcPreference: 'show',
            caianMet: false,
            introReaction: undefined,
        });
    });

    it('每条可选分支和自动跳转都指向存在的节点，并且都能抵达结束', () => {
        for (const node of Object.values(SAR_CAIAN_INTRO_DIALOGUE)) {
            if (node.next) expect(SAR_CAIAN_INTRO_DIALOGUE[node.next]).toBeTruthy();
            for (const choice of node.choices || []) expect(SAR_CAIAN_INTRO_DIALOGUE[choice.next]).toBeTruthy();
        }

        const canReachEnd = (start: string, seen = new Set<string>()): boolean => {
            if (start === 'end') return true;
            if (seen.has(start)) return false;
            const node = SAR_CAIAN_INTRO_DIALOGUE[start];
            const nextSeen = new Set(seen).add(start);
            const targets = [node.next, ...(node.choices || []).map(choice => choice.next)].filter(Boolean) as string[];
            return targets.length > 0 && targets.some(target => canReachEnd(target, nextSeen));
        };

        expect(canReachEnd('start')).toBe(true);
    });
});
