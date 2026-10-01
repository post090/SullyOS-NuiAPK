import {it,expect,beforeEach} from 'vitest';
import {exportBeautyPreferences,importBeautyPreferences} from './beautyPreferencesBackup';
const metadata={name:'搭配',credit:'作者',platforms:['糯米机美化群'],contact:'',allowRemix:false,allowRedistribute:false,exportVersion:'test',bugFeedback:'welcome',message:''};
beforeEach(()=>localStorage.clear());
it('moves repo status, reminders and author defaults without sessions or unknown fields',()=>{
 localStorage.setItem('sully-beauty-repo-status-v1',JSON.stringify({'S-0123456789AB':'manual'}));
 localStorage.setItem('sully-beauty-author-defaults-v1',JSON.stringify({...metadata,name:'',password:'SECRET'}));
 localStorage.setItem('sully-beauty-usage-v1',JSON.stringify({disabled:true,uses:[{target:'chat:a',startedAt:100,share:{code:'S-0123456789AB',kind:'chat-decoration',revision:'one',bytes:200,sha256:'abc',metadata}}],reminded:['S-0123456789AB'],lastPromptAt:123}));
 localStorage.setItem('sully-beauty-author-session-v1','SECRET');localStorage.setItem('sully-beauty-repo-device','SECRET');
 const backup=exportBeautyPreferences();expect(JSON.stringify(backup)).not.toContain('SECRET');localStorage.clear();importBeautyPreferences(backup);
 expect(JSON.parse(localStorage.getItem('sully-beauty-usage-v1')!)).toMatchObject({disabled:true,lastPromptAt:123,uses:[{target:'chat:a',startedAt:100}]});
 expect(JSON.parse(localStorage.getItem('sully-beauty-repo-status-v1')!)['S-0123456789AB']).toBe('manual');
 expect(JSON.parse(localStorage.getItem('sully-beauty-author-defaults-v1')!).credit).toBe('作者');
});
it('preserves settings for older backups and never restores arbitrary storage keys',()=>{
 localStorage.setItem('sully-beauty-repo-status-v1','{}');importBeautyPreferences(undefined);expect(localStorage.getItem('sully-beauty-repo-status-v1')).toBe('{}');
 importBeautyPreferences({version:1,values:{'sully-beauty-author-session-v1':'SECRET'}});expect(localStorage.getItem('sully-beauty-author-session-v1')).toBeNull();
 expect(()=>importBeautyPreferences({version:2,values:{}})).toThrow('版本');
});
