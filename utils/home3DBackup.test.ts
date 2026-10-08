import {beforeEach,describe,it,expect,vi} from 'vitest';
import {exportHome3DLocal,importHome3DLocal,HOME3D_LOCAL_KEYS} from './home3DBackup';
import {readPhotoLooks,PHOTO_LOOK_LIBRARY_KEY} from '../apps/room3d/photoLookStorage';

beforeEach(()=>localStorage.clear());
describe('3D 家园本机偏好备份',()=>{
 it('restores display preferences and saved photo looks into their real readers',()=>{
  const look={id:'private-id',name:'我的滤镜',look:{preset:'dream',glow:.6,fringe:.2,vignette:.1,exposure:1.1}};
  localStorage.setItem(PHOTO_LOOK_LIBRARY_KEY,JSON.stringify([look]));
  localStorage.setItem('sully-home3d-quality','eco');
  localStorage.setItem('sully-home3d-light-mode','night');
  const backup=exportHome3DLocal();localStorage.clear();importHome3DLocal(backup);
  expect(readPhotoLooks()).toEqual([look]);expect(exportHome3DLocal()).toEqual(backup);
 });
 it('keeps old-backup preferences, restores explicit defaults, and cannot overwrite unrelated keys',()=>{
  localStorage.setItem('sully-home3d-quality','eco');localStorage.setItem('os_api_config','private');
  importHome3DLocal(undefined);expect(localStorage.getItem('sully-home3d-quality')).toBe('eco');
  importHome3DLocal({os_api_config:'attacker'});
  expect(localStorage.getItem('os_api_config')).toBe('private');
  expect(HOME3D_LOCAL_KEYS.every(key=>localStorage.getItem(key)===null)).toBe(true);
 });
 it.each([null,[],{'sully-home3d-quality':'invalid'},{[PHOTO_LOOK_LIBRARY_KEY]:'{'},{[PHOTO_LOOK_LIBRARY_KEY]:'[{"id":"x","name":"y","look":{"preset":"dream","glow":99}}]'}])('validates the entire section before modifying local preferences: %j',bad=>{
  localStorage.setItem('sully-home3d-quality','eco');
  expect(()=>importHome3DLocal(bad)).toThrow();expect(localStorage.getItem('sully-home3d-quality')).toBe('eco');
 });
 it('rolls back earlier keys when storage rejects a later write',()=>{
  localStorage.setItem('sully-home3d-room-scope','room');localStorage.setItem('sully-home3d-quality','clear');
  const original=localStorage.setItem.bind(localStorage);
  const spy=vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{if(key==='sully-home3d-quality'&&value==='eco')throw Error('quota');original(key,value);});
  try{expect(()=>importHome3DLocal({'sully-home3d-room-scope':'floor','sully-home3d-quality':'eco'})).toThrow('quota');}
  finally{spy.mockRestore();}
  expect(localStorage.getItem('sully-home3d-room-scope')).toBe('room');expect(localStorage.getItem('sully-home3d-quality')).toBe('clear');
 });
});
