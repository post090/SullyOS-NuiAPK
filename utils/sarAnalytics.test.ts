import { beforeEach, expect, it, vi } from 'vitest';
const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('./analytics', () => ({ trackEvent }));
import { trackSARFeature, trackSARModuleEnd, trackAnniversaryDownload } from './sarAnalytics';
beforeEach(() => vi.clearAllMocks());
it('提前结束只统计对象类型，不上传角色名、模块名或轮次', () => {
    trackSARModuleEnd('私密角色名');
    trackSARModuleEnd('constructor');
    expect(trackEvent).not.toHaveBeenCalled();
    trackSARModuleEnd('character');
    trackSARModuleEnd('user');
    expect(trackEvent.mock.calls).toEqual([
        ['提前结束SAR模块', { 对象: '角色' }], ['提前结束SAR模块', { 对象: '自己' }],
    ]);
});
it('只允许固定 SAR 入口，未知/原型键/秘密字符串不会透传', () => {
    for (const input of ['https://private.invalid/secret', 'private-char-name', 'constructor', '__proto__', '', 'unknown']) trackSARFeature(input);
    expect(trackEvent).not.toHaveBeenCalled();
    for (const input of ['room','dialogue','replay','water','board','garden','gacha','cabinet','modules','warehouse','settings','collection','roster','simulation']) trackSARFeature(input);
    expect(trackEvent).toHaveBeenCalledTimes(14);
    expect(trackEvent).toHaveBeenCalledWith('使用SAR功能', { 功能: '恐龙花园' });
    expect(trackEvent).toHaveBeenCalledWith('使用SAR功能', { 功能: '推演' });
});
it('周年下载结果只记录固定结果代号，不能带错误原文', () => {
    trackAnniversaryDownload('secret error detail');
    expect(trackEvent).not.toHaveBeenCalled();
    for (const result of ['shared','downloaded','cancelled','failed']) trackAnniversaryDownload(result);
    expect(trackEvent.mock.calls).toEqual([
        ['保存周年赠礼', { 结果: '分享' }], ['保存周年赠礼', { 结果: '下载' }],
        ['保存周年赠礼', { 结果: '取消' }], ['保存周年赠礼', { 结果: '失败' }],
    ]);
});
