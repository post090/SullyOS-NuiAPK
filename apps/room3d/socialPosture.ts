export const SEATED_TARGET_ACTIONS=new Set(['cmu-22_03','cmu-22_09','cmu-22_01']);
export function socialPostureAllowed(id:string,actor='standing',target='standing',participants=1){
 if(actor==='lying'||actor==='transition')return false;
 if(id==='home-hug')return (actor==='standing'||actor==='seated')&&(target==='standing'||target==='seated')&&(actor==='standing'||target==='standing');
 if(id==='vrma-ad2a5118837bfa67')return actor==='seated';
 if(SEATED_TARGET_ACTIONS.has(id))return actor==='standing'&&target==='seated';
 if(actor==='seated')return false;
 return participants!==2||target==='standing';
}
