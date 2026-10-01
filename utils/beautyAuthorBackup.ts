import {BEAUTY_SHARE_URL} from './beautyShareConfig';
// Private personal-backup data. Never attach this to a public beauty package.
const KEY='sully-beauty-author-identity-v1';
export interface BeautyAuthorBackup {version:1;service:string;authorCode:string;password:string}
function checked(value:unknown):BeautyAuthorBackup {
 const v=value as Partial<BeautyAuthorBackup>|null;
 if(v?.version!==1||v.service!==BEAUTY_SHARE_URL||typeof v.authorCode!=='string'||!/^A-[A-F0-9]{16}$/.test(v.authorCode)||typeof v.password!=='string'||v.password.length<12||v.password.length>128)throw Error('作者身份备份无效或不属于当前美化服务');
 return {version:1,service:BEAUTY_SHARE_URL,authorCode:v.authorCode,password:v.password};
}
export function readRememberedBeautyAuthor():BeautyAuthorBackup|null {try{const raw=localStorage.getItem(KEY);return raw?checked(JSON.parse(raw)):null;}catch{return null;}}
export function rememberBeautyAuthor(authorCode:string,password:string){localStorage.setItem(KEY,JSON.stringify(checked({version:1,service:BEAUTY_SHARE_URL,authorCode,password})));}
export function forgetBeautyAuthor(){localStorage.removeItem(KEY);}
export function exportBeautyAuthorBackup(){return readRememberedBeautyAuthor()||undefined;}
export function importBeautyAuthorBackup(value:unknown){if(value===undefined)return;const identity=checked(value);localStorage.setItem(KEY,JSON.stringify(identity));localStorage.removeItem('sully-beauty-author-session-v1');}
