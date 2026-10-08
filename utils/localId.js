/** IDs for local records, including LAN HTTP previews. Not an auth token. */
export function createLocalId() {
 const crypto=globalThis.crypto;
 if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
 const bytes=new Uint8Array(16);
 if(typeof crypto?.getRandomValues==='function')crypto.getRandomValues(bytes);
 else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
