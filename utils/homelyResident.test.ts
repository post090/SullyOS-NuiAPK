import {expect,it} from 'vitest';
import {resolveHomelyResident} from './homelyResident';

const residents=[{id:'a',name:'A'},{id:'b',name:'B'}];
it('keeps the locked resident when another app changes the active chat',()=>{
  expect(resolveHomelyResident(residents,'b','a')).toBe(residents[0]);
  expect(resolveHomelyResident(residents,'a','b')).toBe(residents[1]);
});
it('follows the active chat after unlocking',()=>{
  expect(resolveHomelyResident(residents,'b')).toBe(residents[1]);
});
it('falls back safely when a locked or active resident was removed',()=>{
  expect(resolveHomelyResident(residents,'b','deleted')).toBe(residents[1]);
  expect(resolveHomelyResident(residents,'deleted','deleted')).toBe(residents[0]);
  expect(resolveHomelyResident([],'a','a')).toBeUndefined();
});
