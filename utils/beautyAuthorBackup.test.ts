// @vitest-environment jsdom
import {beforeEach,it,expect} from 'vitest';
import {rememberBeautyAuthor,readRememberedBeautyAuthor,forgetBeautyAuthor,exportBeautyAuthorBackup,importBeautyAuthorBackup} from './beautyAuthorBackup';
beforeEach(()=>localStorage.clear());
it('moves opted-in identity and invalidates the other browser session, without changing original binding IDs',()=>{
 expect(exportBeautyAuthorBackup()).toBeUndefined();rememberBeautyAuthor('A-0123456789ABCDEF','test-password-1234');const backup=exportBeautyAuthorBackup();expect(backup?.authorCode).toBe('A-0123456789ABCDEF');forgetBeautyAuthor();expect(readRememberedBeautyAuthor()).toBeNull();localStorage.setItem('sully-beauty-author-session-v1','old');importBeautyAuthorBackup(backup);expect(readRememberedBeautyAuthor()).toEqual(backup);expect(localStorage.getItem('sully-beauty-author-session-v1')).toBeNull();
});
it('does not erase identity for old backups and rejects another service before writing',()=>{
 rememberBeautyAuthor('A-0123456789ABCDEF','test-password-1234');const before=readRememberedBeautyAuthor();importBeautyAuthorBackup(undefined);expect(readRememberedBeautyAuthor()).toEqual(before);expect(()=>importBeautyAuthorBackup({...before,service:'https://wrong.example'})).toThrow();expect(readRememberedBeautyAuthor()).toEqual(before);
});
it('removes opted-in credentials and omits unknown extra fields',()=>{rememberBeautyAuthor('A-0123456789ABCDEF','test-password-1234');importBeautyAuthorBackup({...exportBeautyAuthorBackup(),extra:'no'});expect(exportBeautyAuthorBackup()).not.toHaveProperty('extra');forgetBeautyAuthor();expect(exportBeautyAuthorBackup()).toBeUndefined();});
