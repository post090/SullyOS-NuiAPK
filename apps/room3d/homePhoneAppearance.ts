import type {OSTheme,ChatTheme} from '../../types';
export function homePhoneAppearance(base:OSTheme):OSTheme{
 // The phone has its own visual identity. Keep unrelated OS settings untouched.
 const clean=Object.fromEntries(Object.entries(base).filter(([key])=>!key.startsWith('chat')&&!key.startsWith('acnh')&&key!=='skin'));
 return {...clean,chatAvatarShape:'rounded',chatAvatarSize:'small',chatAvatarMode:'every_message',chatBubbleStyle:'modern',chatMessageSpacing:'compact',chatShowTimestamp:true,chatInputStyle:'rounded',chatSendButtonStyle:'circle',chatChromeStyle:'soft',chatBackgroundStyle:'plain'} as OSTheme;
}
export const HOME_PHONE_BUBBLES:ChatTheme={
 id:'home-phone',name:'小手机',type:'custom',
 user:{textColor:'#486b57',backgroundColor:'#dfeddf',borderRadius:18,opacity:1,backgroundImageOpacity:0},
 ai:{textColor:'#705c40',backgroundColor:'#fffef8',borderRadius:18,opacity:1,backgroundImageOpacity:0},
};
