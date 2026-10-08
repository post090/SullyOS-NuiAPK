import {describe,it,expect,vi,beforeEach} from 'vitest';
import {trackEvent} from './analytics';
import {trackHomeEntry,trackHomeFeature,trackHomeTransfer} from './homeAnalytics';
vi.mock('./analytics',()=>({trackEvent:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());
describe('home analytics privacy boundary',()=>{
 it('reports only fixed labels for supported actions',()=>{
  trackHomeEntry('home');trackHomeEntry('homely');trackHomeFeature('phone-chat');trackHomeTransfer('import-home');
  expect(vi.mocked(trackEvent).mock.calls).toEqual([
   ['进入3D家园',{入口:'小屋'}],['进入3D家园',{入口:'居家桌面'}],
   ['打开3D家园功能',{功能:'手机聊天'}],['3D家园数据操作',{操作:'恢复整屋备份'}],
  ]);
 });
 it('drops arbitrary text, IDs, URLs, objects and exception messages',()=>{
  for(const poison of ['PRIVATE_NAME','sk-secret','https://private.invalid','#abcdef',null,undefined,{},new Error('私人聊天')]){
   trackHomeEntry(poison);trackHomeFeature(poison);trackHomeTransfer(poison);
  }
  expect(trackEvent).not.toHaveBeenCalled();
 });
});
