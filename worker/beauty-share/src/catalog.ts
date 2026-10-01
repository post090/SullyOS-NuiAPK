import type { Env } from './types';
import { validateBeautyMetadata, validateBeautyPackage } from '../../../utils/beautyShareContract';
import { validateCatalogCover, type BeautyCatalogEntry } from '../../../utils/beautyCatalogContract';
import { sha256 } from './auth';
import {decorationCategories} from '../../../utils/beautyCategories';
import type {DecorationPreset} from '../../../utils/chatDecoration';

export const dirtyCatalog = (env: Env) => env.DB.prepare("INSERT INTO limits(key,value,expires_at) VALUES('catalog-generation',1,0) ON CONFLICT(key) DO UPDATE SET value=value+1");
const cacheFile = {cacheControl:'public, max-age=600',contentType:'application/json; charset=utf-8'};

/** Event-triggered builder. Returns false when another build/change requires retry. */
export async function rebuildCatalog(env: Env) {
  if (!env.CATALOG) throw Error('Catalog bucket missing');
  const bucket=env.CATALOG, token=Date.now();
  const lease=await env.DB.prepare("INSERT INTO limits(key,value,expires_at) VALUES('catalog-lock',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at WHERE expires_at<?")
    .bind(token,token+15*60_000,token).run();
  if (!lease.meta.changes) return false;
  try {
    const generation=String((await env.DB.prepare("SELECT value FROM limits WHERE key='catalog-generation'").first())?.value||0);
    const current=await bucket.head('catalog.json');
    if (current?.customMetadata?.generation===generation && current.customMetadata.cleanup!=='pending') return true;
    const {results}=await env.DB.prepare(`SELECT s.share_code,s.kind,r.id,r.metadata,r.blob_key,r.bytes,r.sha256,r.catalog_cover
      FROM submissions s JOIN revisions r ON r.id=s.published_revision
      WHERE s.deleted_at IS NULL AND s.catalog_hidden=0 AND r.status='approved'
      AND json_extract(r.metadata,'$.allowPublicListing')=1 ORDER BY s.id LIMIT 10001`).all();
    if(results.length>10000)throw Error('Catalog size limit exceeded');
    const entries:BeautyCatalogEntry[]=[], retained=new Set<string>();
    for(const row of results){
      const metadata=validateBeautyMetadata(JSON.parse(row.metadata));
      if(metadata.allowPublicListing!==true)continue;
      // Fail closed: an incomplete snapshot must never replace the last good directory.
      const cover=validateCatalogCover(row.catalog_cover);
      const source=await env.FILES.get(row.blob_key);
      if(!source)throw Error('Catalog source missing');
      const raw=await new Response(source.body).text();
      if(new TextEncoder().encode(raw).byteLength!==row.bytes||await sha256(raw)!==row.sha256)throw Error('Catalog source digest mismatch');
      const pack=validateBeautyPackage(JSON.parse(raw));
      if(pack.kind!==row.kind)throw Error('Catalog source kind mismatch');
      const categories=pack.kind==='appearance'?['appearance']:decorationCategories(pack.data as DecorationPreset);
      const base=`items/${row.share_code}/${row.id}`;
      const file=base+'.json', coverPath=base+(cover.startsWith('data:image/png;')?'.png':'.webp');
      if(!await bucket.head(file))await bucket.put(file,raw,{httpMetadata:cacheFile});
      if(!await bucket.head(coverPath)){
        const bytes=Uint8Array.from(atob(cover.split(',')[1]),c=>c.charCodeAt(0));
        await bucket.put(coverPath,bytes.buffer,{httpMetadata:{...cacheFile,contentType:coverPath.endsWith('.png')?'image/png':'image/webp'}});
      }
      retained.add(file);retained.add(coverPath);
      entries.push({code:row.share_code,kind:row.kind,revision:row.id,metadata,bytes:row.bytes,sha256:row.sha256,categories,file,cover:coverPath});
    }
    // A deletion/review during generation makes this build obsolete. The event job retries.
    const latest=String((await env.DB.prepare("SELECT value FROM limits WHERE key='catalog-generation'").first())?.value||0);
    if(latest!==generation)return false;
    const manifest=JSON.stringify({version:1,generatedAt:token,entries});
    if(new TextEncoder().encode(manifest).byteLength>8*1024*1024)throw Error('Catalog manifest size limit exceeded');
    const manifestHeaders={...cacheFile,cacheControl:'public, no-cache, max-age=0, must-revalidate'};
    await bucket.put('catalog.json',manifest,{httpMetadata:manifestHeaders,customMetadata:{generation,cleanup:'pending'}});
    // Remove obsolete public copies only. The private submission bucket is untouched.
    let cursor:string|undefined;
    do{
      const page=await bucket.list({prefix:'items/',cursor});
      for(const object of page.objects)if(!retained.has(object.key))await bucket.delete(object.key);
      cursor=page.truncated?page.cursor:undefined;
    }while(cursor);
    // A failed cleanup must be retried even though the new directory was published.
    await bucket.put('catalog.json',manifest,{httpMetadata:manifestHeaders,customMetadata:{generation,cleanup:'done'}});
    return true;
  }finally{
    await env.DB.prepare("DELETE FROM limits WHERE key='catalog-lock' AND value=?").bind(token).run();
  }
}
