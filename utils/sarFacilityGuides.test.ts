import { beforeEach, expect, it } from 'vitest';
import { SAR_FACILITY_IDS, SAR_FACILITY_GUIDES, sarFacilityGuideKey } from './vrWorld/sarFacilityGuides';
import { collectSARLocalBackup, restoreSARLocalBackup } from './vrWorld/sarBackup';
import { sarGreetingExpression } from './vrWorld/sarGreetingExpression';
import { SAR_EXPRESSIONS, type SARExpression } from './vrWorld/sarArt';
beforeEach(() => localStorage.clear());
it('七处引导的完成状态跟随 SAR 备份，旧备份不会残留另一台设备的完成标记', () => {
    for (const id of SAR_FACILITY_IDS) localStorage.setItem(sarFacilityGuideKey(id), 'done');
    const backup = collectSARLocalBackup(); localStorage.clear();
    restoreSARLocalBackup(JSON.parse(JSON.stringify(backup)), { replaceMissing: true });
    for (const id of SAR_FACILITY_IDS) expect(localStorage.getItem(sarFacilityGuideKey(id))).toBe('done');
    restoreSARLocalBackup(undefined, { replaceMissing: false });
    expect(localStorage.getItem(sarFacilityGuideKey('water'))).toBe('done');
    restoreSARLocalBackup(undefined, { replaceMissing: true });
    for (const id of SAR_FACILITY_IDS) expect(localStorage.getItem(sarFacilityGuideKey(id))).toBeNull();
});
it('恐龙和钓鱼归艾文；其他设施归凯恩，扭蛋说明清楚区分两池与去处', () => {
    for (const id of SAR_FACILITY_IDS) expect(SAR_FACILITY_GUIDES[id].npc).toBe(['water', 'garden'].includes(id) ? 'aiven' : 'caian');
    const steps = SAR_FACILITY_GUIDES.gacha.steps.map(step => step.text).join('');
    expect(steps).toContain('独立抽'); expect(steps).toContain('组装柜'); expect(steps).toContain('铸造');
});
it.each(['caian', 'aiven'] as const)('%s 日常三句只用可用表情，并避免连续三句一个表情', npc => {
    const lines = npc === 'caian' ? ['早上好！', '今天天气不错呢！', '今天就好好休息吧！'] : ['早上水比较安静。', '水面有点亮。', '今天还是可以钓鱼。'];
    const expressions: SARExpression[] = [];
    lines.forEach((line, index) => expressions.push(sarGreetingExpression(npc, line, index, expressions.at(-1))));
    expect(new Set(expressions).size).toBeGreaterThan(1);
    expect(expressions).not.toContain('embarrassed');
    for (const expression of expressions) expect(SAR_EXPRESSIONS[npc]).toContain(expression);
});
