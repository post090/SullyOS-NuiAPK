import { trackEvent } from './analytics';

// 分发处重写固定字面量。新增入口不会自动上传，角色、剧情、物品名称不进统计。
export function trackSARFeature(feature: string): void {
    let label: string;
    switch (feature) {
        case 'room': label = '活动室'; break;
        case 'dialogue': label = '角色交谈'; break;
        case 'replay': label = '剧情回顾'; break;
        case 'water': label = '钓鱼'; break;
        case 'board': label = '水产市场'; break;
        case 'garden': label = '恐龙花园'; break;
        case 'gacha': label = '芯片卡池'; break;
        case 'cabinet': label = '组装柜'; break;
        case 'modules': label = '模块商店'; break;
        case 'warehouse': label = '仓库'; break;
        case 'settings': label = '设置'; break;
        case 'collection': label = '收藏册'; break;
        case 'roster': label = '名册'; break;
        case 'simulation': label = '推演'; break;
        default: return;
    }
    trackEvent('使用SAR功能', { 功能: label });
}

export function trackSARModuleEnd(target: string): void {
    if (target === 'character') trackEvent('提前结束SAR模块', { 对象: '角色' });
    else if (target === 'user') trackEvent('提前结束SAR模块', { 对象: '自己' });
}

export function trackAnniversaryDownload(result: string): void {
    switch (result) {
        case 'shared': trackEvent('保存周年赠礼', { 结果: '分享' }); break;
        case 'downloaded': trackEvent('保存周年赠礼', { 结果: '下载' }); break;
        case 'cancelled': trackEvent('保存周年赠礼', { 结果: '取消' }); break;
        case 'failed': trackEvent('保存周年赠礼', { 结果: '失败' }); break;
    }
}
