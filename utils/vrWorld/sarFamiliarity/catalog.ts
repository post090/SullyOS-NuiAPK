import { CAIAN_SCENES, CAIAN_DAILY } from './caian';
import { AIVEN_SCENES, AIVEN_DAILY } from './aiven';
import type { FamiliarityNpc } from './types';
export const FAMILIARITY_SCENES = [...CAIAN_SCENES, ...AIVEN_SCENES];
export const familiarityScene = (id: string) => FAMILIARITY_SCENES.find(s => s.id === id);
export const familiarityScenes = (npc: FamiliarityNpc) => FAMILIARITY_SCENES.filter(s => s.npc === npc);
export const FAMILIARITY_DAILY = { caian: CAIAN_DAILY, aiven: AIVEN_DAILY };
export const familiarityUserName = (name?: string) => !name?.trim() || /^user$/i.test(name.trim()) ? '你' : name.trim();
export const familiarityText = (text: string, userName: string, flags: Record<string,string|boolean> = {}) =>
    text.replace(/[（(]\s*user(?:名)?\s*[）)]|\{\{\s*user(?:名|name)?\s*\}\}|\buser\b/gi, () => familiarityUserName(userName))
        .replace(/\{\{meetingConclusion\}\}/g, () => String(flags.meetingConclusion || '未得出结论'));
