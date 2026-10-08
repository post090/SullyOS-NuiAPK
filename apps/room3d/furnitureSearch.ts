/** Match words, separated keywords and abbreviated Chinese names in order. */
export function furnitureSearch(text:string,query:string){
 const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[\s·\-_/]/g,'');
 const haystack=normalize(text);
 return query.trim().split(/\s+/).every(word=>{let at=0;for(const c of normalize(word)){const found=haystack.indexOf(c,at);if(found<0)return false;at=found+1;}return true;});
}
