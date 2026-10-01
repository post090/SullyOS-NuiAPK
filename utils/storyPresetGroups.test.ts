import { describe, expect, it } from 'vitest';
import { addStoryPresetGroup, renameStoryPresetGroup, ungroupStoryPresetGroup, moveStoryPresetPromptToGroup, getStoryPresetPromptGroups, createBlankStoryPreset, parseStoryTheaterPreset, compileStoryPreset, BUILTIN_NIGHT_SCREENING_PRESET, duplicateStoryPreset } from './storyTheater';

describe('剧情自定义大区', () => {
    it('空分组可保存、改名、导出导入，移动条目后正文只发送一次', () => {
        let preset = createBlankStoryPreset();
        preset.document = addStoryPresetGroup(preset.document, '我的文风');
        const group = getStoryPresetPromptGroups(preset.document).at(-1)!;
        expect(group.label).toBe('我的文风');
        preset.document = moveStoryPresetPromptToGroup(preset.document, preset.document.prompts[0].id, group.key);
        preset.document = renameStoryPresetGroup(preset.document, group.customSectionId!, '写作习惯');
        const imported = parseStoryTheaterPreset(JSON.stringify(preset.document), 'test.json');
        expect(getStoryPresetPromptGroups(imported.document).at(-1)?.label).toBe('写作习惯');
        const compiled = compileStoryPreset({ preset: imported, userName: '用户', characterNames: ['角色'], slots: { actors: '角色资料', persona: '', scenario: '', worldBefore: '', worldAfter: '', history: '' } });
        const text = JSON.stringify(compiled.messages);
        expect(text).not.toContain('写作习惯');
        expect(text.match(/直接续写连续的第三人称故事/g)).toHaveLength(1);
        const ungrouped = ungroupStoryPresetGroup(imported.document, group.customSectionId!);
        expect(ungrouped.prompts).toHaveLength(6);
        expect(ungrouped.prompts.some(prompt => prompt.content.includes('直接续写'))).toBe(true);
    });
    it('保留内置区的保护规则，不允许把系统连接位移出或将普通条目移入', () => {
        const doc = addStoryPresetGroup(duplicateStoryPreset(BUILTIN_NIGHT_SCREENING_PRESET).document, '自定义');
        const groups = getStoryPresetPromptGroups(doc);
        const protectedGroup = groups.find(group => group.protected)!;
        const custom = groups.at(-1)!;
        const protectedId = protectedGroup.promptIds[1];
        expect(moveStoryPresetPromptToGroup(doc, protectedId, custom.key)).toBe(doc);
        expect(moveStoryPresetPromptToGroup(doc, doc.prompts.find(prompt => prompt.content && !prompt.marker)!.id, protectedGroup.key)).toBe(doc);
    });
});
