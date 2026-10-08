import {trackEvent} from './analytics';

/** Whitelisted UI actions only. Never pass records, IDs, names, colors or exception text. */
export function trackHomeEntry(value: unknown): void {
    if (value === 'home') trackEvent('进入3D家园', {入口: '小屋'});
    else if (value === 'homely') trackEvent('进入3D家园', {入口: '居家桌面'});
}

export function trackHomeFeature(value: unknown): void {
    let feature: string;
    switch (value) {
        case 'chat': feature = '当面聊天'; break;
        case 'journal': feature = '日常记录'; break;
        case 'more': feature = '家园设置'; break;
        case 'interact': feature = '人物互动'; break;
        case 'phone': feature = '小手机'; break;
        case 'phone-chat': feature = '手机聊天'; break;
        case 'camera': feature = '拍照'; break;
        case 'edit': feature = '布置房屋'; break;
        case 'room-share': feature = '房间分享'; break;
        case 'figures': feature = '3D形象'; break;
        case 'pets': feature = '宠物'; break;
        default: return;
    }
    trackEvent('打开3D家园功能', {功能: feature});
}

export function trackHomeTransfer(value: unknown): void {
    let action: string;
    switch (value) {
        case 'export-home': action = '下载整屋备份'; break;
        case 'import-home': action = '恢复整屋备份'; break;
        case 'export-room': action = '下载房间布局'; break;
        case 'copy-room': action = '复制房间布局'; break;
        case 'import-room': action = '应用房间布局'; break;
        default: return;
    }
    trackEvent('3D家园数据操作', {操作: action});
}
