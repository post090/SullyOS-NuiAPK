export const SAR_UPDATE_KEY = 'sullyos_update_2026_09_11_sar_seen';
export const SAR_CHANGELOG = 'changelog-2026-09-11';

// 公告跳转只在当前标签页内消费一次，不改变默认的彼方首页。
let openSAR = false;
export const sarLaunch = {
    request: () => { openSAR = true; },
    peek: () => openSAR,
    consume: () => { const pending = openSAR; openSAR = false; return pending; },
};
