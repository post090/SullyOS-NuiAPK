/** Read selector ranges without treating comments, strings or keyframe steps as selectors. */
export function cssRuleSelectors(source:string){
 const rules:{start:number;end:number}[]=[];
 const braces:number[]=[];
 const unclosed:number[]=[];
 const extra:number[]=[];
 const containers:boolean[]=[true];
 let start=0,quote='',comment=false,round=0,square=0;
 for(let i=0;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(comment){if(c==='*'&&next==='/'){comment=false;i++;}continue;}
  if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote='';continue;}
  if(c==='/'&&next==='*'){comment=true;i++;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='\\'){i++;continue;}
  if(c==='(')round++;else if(c===')')round--;
  if(c==='[')square++;else if(c===']')square--;
  if(round||square)continue;
  if(c==='{'){
   const header=source.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();
   if(containers[containers.length-1]&&header&&!header.startsWith('@'))rules.push({start,end:i});
   containers.push(/^@(media|supports|layer|container|document|scope|starting-style)\b/i.test(header));
   braces.push(i);start=i+1;
  }else if(c==='}'){
   if(braces.length){braces.pop();containers.pop();}else extra.push(i);
   start=i+1;
  }else if(c===';')start=i+1;
 }
 unclosed.push(...braces);
 return {rules,unclosed,extra};
}

/** Commas inside :is(), :not() and attribute values are not selector separators. */
export function splitCssSelectors(group:string){
 const parts:string[]=[];let start=0,quote='',comment=false,depth=0;
 for(let i=0;i<group.length;i++){
  const c=group[i];
  if(comment){if(c==='*'&&group[i+1]==='/'){comment=false;i++;}continue;}
  if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
  if(c==='/'&&group[i+1]==='*'){comment=true;i++;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='\\'){i++;continue;}
  if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;
  if(c===','&&!depth){parts.push(group.slice(start,i));start=i+1;}
 }
 parts.push(group.slice(start));return parts;
}

/** Preserve offsets/newlines when removing comments for validation. */
export const maskCssComments=(source:string)=>source.replace(/\/\*[\s\S]*?\*\//g,comment=>comment.replace(/[^\n\r]/g,' '));
