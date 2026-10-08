import {expect,it} from 'vitest';
import {homePhoneAppearance,HOME_PHONE_BUBBLES} from '../apps/room3d/homePhoneAppearance';
import type {OSTheme} from '../types';
it('isolates the home phone from saved chat decorations without modifying preferences',()=>{
 const base={skin:'animalcrossing',chatChromeCustomCss:'UNWANTED CSS',chatBackground:'wallpaper',chatAvatarSize:'large',chatSound:{src:'sound'},chatFineTune:{enabled:true},unrelated:'keep'} as unknown as OSTheme;
 const result=homePhoneAppearance(base);
 expect(result.chatChromeCustomCss).toBeUndefined();expect(result.chatBackground).toBeUndefined();expect(result.chatSound).toBeUndefined();
 expect(result.chatAvatarSize).toBe('small');expect(result).toHaveProperty('unrelated','keep');
 expect(base.chatChromeCustomCss).toBe('UNWANTED CSS');expect(HOME_PHONE_BUBBLES.customCss).toBeUndefined();
});
