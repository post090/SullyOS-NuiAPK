import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Launcher from '../../apps/Launcher';
import { OSPreviewProvider } from '../../context/OSContext';
import { MusicPreviewProvider } from '../../context/MusicContext';
import { validateBeautyPackage } from '../../utils/beautyShareContract';
import { resolveBlobRefsDeep } from '../../utils/blobRef';
import type { CharacterProfile } from '../../types';
import {BEAUTY_PREVIEW_AVATAR} from '../../utils/beautyPreviewAssets';
import baseCss from '../chat/chatPreview.generated.css?inline';

const noop = () => {};

/** Render only: React effects, DB reads and real desktop actions never mount. */
export async function renderDesktopDecorationSample(value: unknown, page: number) {
    const result = validateBeautyPackage(value);
    if (result.kind !== 'appearance') return null;
    const data = structuredClone(result.data);
    if (data.theme.skin && !['default', 'animalcrossing'].includes(data.theme.skin)) return null;
    await resolveBlobRefsDeep(data);
    const character = { id: 'preview-character', name: '示例角色', avatar: BEAUTY_PREVIEW_AVATAR } as CharacterProfile;
    const os = {
        theme: data.theme, customIcons: data.customIcons || {}, characters: [character],
        activeCharacterId: character.id, unreadMessages: {}, isDataLoaded: false,
        virtualTime: { hours: 9, minutes: 41 }, openApp: noop, updateTheme: noop,
    } as unknown as React.ComponentProps<typeof OSPreviewProvider>['value'];
    const music = { current: null, playing: false, progress: 0, duration: 0, togglePlay: noop, nextSong: noop, prevSong: noop } as React.ComponentProps<typeof MusicPreviewProvider>['value'];
    const wallpaper = data.theme.wallpaper;
    const background = typeof wallpaper === 'string' && /^(https?:\/\/|data:image\/|blob:|\/(?!\/))/.test(wallpaper)
        ? `url(${JSON.stringify(wallpaper)}) center / cover no-repeat` : '#ddd6eb';
    const markup = renderToStaticMarkup(<OSPreviewProvider value={os}><MusicPreviewProvider value={music}>
        <div style={{ width: 360, height: 720, background, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 8, left: 24, right: 24, zIndex: 40, color: data.theme.contentColor || '#fff', fontSize: 11 }}>09:41<span style={{ float: 'right' }}>● ▰</span></div>
            <Launcher staticPreview />
        </div>
    </MusicPreviewProvider></OSPreviewProvider>);
    return { markup, css: `${baseCss}
        .beauty-preview-body{width:360px;height:720px;font:14px/1.5 system-ui;--app-font:system-ui;--chrome-top:24px;--safe-top:0px;--safe-bottom:0px}
        .launcher-pages{overflow-x:hidden!important}
        .launcher-pages>div{display:none!important;content-visibility:visible!important}
        .launcher-pages>div:nth-child(${page + 1}){display:flex!important}
        .launcher-desktop>div[aria-hidden="true"]>div>div{width:6px!important;opacity:.4!important}
        .launcher-desktop>div[aria-hidden="true"]>div:nth-child(${page + 1})>div{width:16px!important;opacity:1!important}
        .launcher-page{pointer-events:auto!important}
        .no-scrollbar{scrollbar-width:none}
        .no-scrollbar::-webkit-scrollbar{display:none}
    ` };
}
