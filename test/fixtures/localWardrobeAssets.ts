import {readFileSync} from 'node:fs';
import {vi} from 'vitest';

export function stubLocalWardrobeAssets(){
 vi.stubGlobal('location',{href:'https://example.test/'});
 vi.stubGlobal('fetch',vi.fn(async (url:string|URL)=>{
  const file=String(url).split('/').pop()!.split('?')[0];
  const bytes=readFileSync(`public/room3d/wardrobe/${file}`);
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 }));
}
