// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';

afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});

it.each([
 ['/', 'https://friedsully.com/', 'https://friedsully.com/sully/head.png'],
 ['./', 'https://qegj567-cloud.github.io/SullyOS/', 'https://qegj567-cloud.github.io/SullyOS/sully/head.png'],
 ['/SullyOS/', 'https://qegj567-cloud.github.io/SullyOS/', 'https://qegj567-cloud.github.io/SullyOS/sully/head.png'],
])('keeps rendered preview images inside deployment base %s',async(base,page,expected)=>{
 vi.stubEnv('BASE_URL',base);vi.resetModules();
 const {BEAUTY_PREVIEW_AVATAR}=await import('./beautyPreviewAssets');
 const {CHAT_PREVIEW_SCENES,CHAT_TYPE_SAMPLES}=await import('./chatPreviewFixtures');
 const {renderChatDecorationSample}=await import('../components/chat/ChatDecorationSample');
 expect(new URL(BEAUTY_PREVIEW_AVATAR,page).href).toBe(expected);
 expect(CHAT_TYPE_SAMPLES.image.content).toBe(BEAUTY_PREVIEW_AVATAR);
 expect(CHAT_TYPE_SAMPLES.emoji.content).toBe(BEAUTY_PREVIEW_AVATAR);
 const preset={format:'sullyos-chat-decoration',version:1,name:'test',parts:{css:''}};
 for(const scene of CHAT_PREVIEW_SCENES){
  const root=document.createElement('div');
  root.innerHTML=renderChatDecorationSample(preset,scene.id).markup;
  const avatars=Array.from(root.querySelectorAll('img')).filter(img=>img.getAttribute('src')?.includes('sully/head.png'));
  expect(avatars.length,scene.id).toBeGreaterThan(0);
  for(const avatar of avatars)expect(new URL(avatar.getAttribute('src')!,page).href,scene.id).toBe(expected);
 }
},30000);
