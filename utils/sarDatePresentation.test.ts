import { describe, expect, it } from 'vitest';
import { resolveSARDateSpeech } from './sarDatePresentation';

const lines = (...texts: string[]) => texts.map(text => ({ text }));
const message = { id: 12, moduleTitle: '模块', surface: lines('哼。', '哼。', '才不是。'), canonical: lines('你好。', '再见。', '是的。') };
describe('SAR 见面双层台词定位', () => {
    it('重复的污染短句按整批进度匹配，不会总配第一句原文', () => {
        expect(resolveSARDateSpeech([message], message.surface, 1, '哼。')?.canonical).toBe('再见。');
    });
    it('旧续接快照的引擎存着原台词时仍能找到污染台词', () => {
        expect(resolveSARDateSpeech([message], message.canonical, 0, '是的。')?.surface).toBe('才不是。');
    });
    it('普通的新回复恰好同样一句话，不继承旧模块显示', () => {
        expect(resolveSARDateSpeech([message], lines('哼。'), 0, '哼。')).toBeNull();
    });
    it('旧快照缺整批时只接受唯一命中，不猜重复句', () => {
        expect(resolveSARDateSpeech([message], [], 0, '哼。')).toBeNull();
        expect(resolveSARDateSpeech([message], [], 0, '是的。')?.surface).toBe('才不是。');
    });
    it('格式异常使行数不等时保留完整原文和外显的尾句', () => {
        const uneven = { ...message, canonical: lines('第一句。', '第二句。', '第三句。', '尾句。') };
        expect(resolveSARDateSpeech([uneven], uneven.surface, 0, '才不是。')).toMatchObject({
            canonical: '第一句。\n第二句。\n第三句。\n尾句。', surface: '哼。\n哼。\n才不是。',
        });
    });
    it('切批瞬间当前行还没更新时不闪现另一段台词', () => {
        expect(resolveSARDateSpeech([message], message.surface, 0, '哼。')).toBeNull();
    });
});
