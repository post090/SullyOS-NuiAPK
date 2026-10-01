import { beforeEach, describe, expect, it } from 'vitest';
import { collectSARLocalBackup, restoreSARLocalBackup } from './vrWorld/sarBackup';
import { loadChatInputPreferences, saveChatInputPreferences, CHAT_INPUT_PREFERENCES_KEY } from './chatInputPreferences';

beforeEach(() => localStorage.clear());
describe('SAR / 私聊偏好备份兼容', () => {
    it('完整还原已关闭的开关、配色和引导记录，不把 false 当成没保存', () => {
        localStorage.setItem('vr_fishing_simple_mode', 'false');
        localStorage.setItem('vr_sar_session_theme_v1', 'light');
        localStorage.setItem('sar-garden-guide-v1', 'done');
        const backup = collectSARLocalBackup();
        localStorage.clear();
        restoreSARLocalBackup(JSON.parse(JSON.stringify(backup)), { replaceMissing: true });
        expect(collectSARLocalBackup()).toEqual(backup);
    });
    it('旧主历史清理 SAR 偏好；仅媒体/局部备份不清理', () => {
        localStorage.setItem('vr_fishing_simple_mode', 'true');
        restoreSARLocalBackup(undefined, { replaceMissing: false });
        expect(localStorage.getItem('vr_fishing_simple_mode')).toBe('true');
        restoreSARLocalBackup(undefined, { replaceMissing: true });
        expect(localStorage.getItem('vr_fishing_simple_mode')).toBeNull();
    });
    it('备份中的未知键与非法值不能写入其他配置', () => {
        restoreSARLocalBackup({ version: 1, preferences: { os_api_config: 'poison', vr_sar_session_theme_v1: 'poison', vr_fishing_simple_mode: 'true' } }, { replaceMissing: true });
        expect(localStorage.getItem('os_api_config')).toBeNull();
        expect(localStorage.getItem('vr_sar_session_theme_v1')).toBeNull();
        expect(localStorage.getItem('vr_fishing_simple_mode')).toBe('true');
    });
    it('聊天偏好保留明确布尔值，旧字段缺省按用户指定默认值，忽略未知内容', () => {
        saveChatInputPreferences({ sendButtonGenerates: true, enterToSend: false, autoReply: true, emojiSuggestions: true });
        expect(loadChatInputPreferences()).toEqual({ sendButtonGenerates: true, enterToSend: false, autoReply: true, emojiSuggestions: true });
        saveChatInputPreferences({ enterToSend: false, private: 'poison', autoReply: 'true' } as any);
        expect(loadChatInputPreferences()).toEqual({ sendButtonGenerates: false, enterToSend: false, autoReply: false, emojiSuggestions: false });
        expect(localStorage.getItem(CHAT_INPUT_PREFERENCES_KEY)).not.toContain('poison');
    });
});


it('导出旧日期商店不刷新货架，也不消耗或重置当天次数', () => {
    const shop = { version:1, credits:0, inventory:{}, purchases:[], market:{ dayKey:'2020-01-01', offerIds:['saved-offer'], rollsRemaining:1 } };
    localStorage.setItem('vr_sar_module_shop_v1', JSON.stringify(shop));
    const before = localStorage.getItem('vr_sar_module_shop_v1');
    expect(collectSARLocalBackup().moduleShop).toEqual(shop);
    expect(collectSARLocalBackup().moduleShop).toEqual(shop);
    expect(localStorage.getItem('vr_sar_module_shop_v1')).toBe(before);
});
