import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimFeedbackInvitation, FEEDBACK_INVITATION_KEY, hasPriorFeedbackInstallEvidence, initializeFeedbackInvitation, recordFeedbackVisit, shouldShowFeedbackInvitation, suppressFeedbackInvitation } from './feedbackInvitation';

const DAY = 24 * 60 * 60 * 1000;
const START = new Date(2026, 8, 20, 12).getTime();
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
const visit = (days: number[]) => days.forEach(day => recordFeedbackVisit(START + day * DAY));

describe('新用户 repo 邀请', () => {
    it('已有角色或安装痕迹的用户永久跳过', () => {
        for (const [count, evidence] of [[1, false], [0, true]] as const) {
            localStorage.clear(); initializeFeedbackInvitation(count, evidence, START);
            visit([0, 1, 7, 90]);
            expect(shouldShowFeedbackInvitation(START + 90 * DAY)).toBe(false);
        }
    });
    it('首次使用满七天且三个不同日期才符合条件，同日刷新不累计', () => {
        initializeFeedbackInvitation(0, false, START);
        visit([0, 0, 0, 1]);
        expect(shouldShowFeedbackInvitation(START + 7 * DAY)).toBe(false);
        visit([2]);
        expect(shouldShowFeedbackInvitation(START + 7 * DAY - 1)).toBe(false);
        expect(shouldShowFeedbackInvitation(START + 7 * DAY)).toBe(true);
    });
    it('跨刷新继续原起点，不因后来已有内置角色变成旧用户', () => {
        initializeFeedbackInvitation(0, false, START); visit([0, 1]);
        initializeFeedbackInvitation(1, true, START + 7 * DAY); visit([7]);
        expect(shouldShowFeedbackInvitation(START + 7 * DAY)).toBe(true);
    });
    it('在显示时消费资格，未点击、刷新或重开也只弹一次', () => {
        initializeFeedbackInvitation(0, false, START); visit([0, 1, 7]);
        expect(claimFeedbackInvitation(START + 7 * DAY)).toBe(true);
        expect(claimFeedbackInvitation(START + 7 * DAY)).toBe(false);
        initializeFeedbackInvitation(0, false, START + 30 * DAY); visit([30]);
        expect(shouldShowFeedbackInvitation(START + 30 * DAY)).toBe(false);
    });
    it('未成功初始化、不明或损坏的状态不弹', () => {
        visit([0, 1, 7]); expect(shouldShowFeedbackInvitation(START + 7 * DAY)).toBe(false);
        localStorage.setItem(FEEDBACK_INVITATION_KEY, 'broken');
        initializeFeedbackInvitation(0, false, START); visit([0, 1, 7]);
        expect(claimFeedbackInvitation(START + 7 * DAY)).toBe(false);
    });
    it('仅保存前三个使用日期，导入备份立即取消资格', () => {
        initializeFeedbackInvitation(0, false, START); visit([0, 1, 2, 7, 8]);
        expect(JSON.parse(localStorage.getItem(FEEDBACK_INVITATION_KEY)!).days).toHaveLength(3);
        suppressFeedbackInvitation();
        expect(shouldShowFeedbackInvitation(START + 8 * DAY)).toBe(false);
    });
    it('识别引导完成、免责声明和旧设置', () => {
        expect(hasPriorFeedbackInstallEvidence()).toBe(false);
        for (const key of ['os_first_use_memory_guide_v1', 'sullyos_disclaimer_accepted', 'os_theme', 'os_api_config']) {
            localStorage.clear(); localStorage.setItem(key, 'done');
            expect(hasPriorFeedbackInstallEvidence()).toBe(true);
        }
    });
    it('本地存储写入失败时不展示', () => {
        initializeFeedbackInvitation(0, false, START); visit([0, 1, 7]);
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        expect(claimFeedbackInvitation(START + 7 * DAY)).toBe(false);
    });
});
