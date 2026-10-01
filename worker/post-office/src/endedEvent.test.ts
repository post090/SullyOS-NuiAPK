import { expect, it, vi } from 'vitest';
import worker from './index';
const request=(path:string,method='GET')=>new Request('https://example.invalid'+path,{method});
it.each(['lock','unlock','start','append','booklet','admin-pause','future-write'])('rejects %s before touching DB even for old prefixed clients',async route=>{
    const response=await worker.fetch(request('/po/poem/'+route,'POST'),{} as any);expect(response.status).toBe(410);expect(await response.json()).toMatchObject({ended:true});
});
it('reading memorial does no schema, migration, lock, flag or seed writes and retains unfinished poem',async()=>{
    const queries:string[]=[];
    const db={prepare:vi.fn((sql:string)=>{queries.push(sql);expect(sql.trim()).toMatch(/^SELECT/);
        const stmt={bind:()=>stmt,first:async()=>sql.includes('FROM po_booklets')?{id:'book',title:'原册',poems_target:20}:sql.includes("status = 'open'")?{id:'unfinished',title:'原诗',status:'open'}:null,
            all:async()=>({results:sql.includes('FROM po_poem_lines')?[{seq:1,device:'mine',pen:'原笔名',content:'原句'}]:[]}),run:vi.fn(()=>{throw Error('write');})};return stmt;}),exec:vi.fn(()=>{throw Error('schema');})};
    const r=await worker.fetch(request('/po/poem/current?device=mine'),{DB:db} as any);expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ended:true,paused:true,booklet:{poemsTarget:20},poem:{title:'原诗',lines:[{content:'原句',mine:true}]}});expect(db.exec).not.toHaveBeenCalled();
    expect(queries.length).toBeGreaterThan(0);
});
it('empty archive stays empty, feed is SELECT-only, admin deletion still needs auth',async()=>{
    const db={prepare:(sql:string)=>{expect(sql).toMatch(/^SELECT/);const stmt={bind:()=>stmt,first:async()=>null,all:async()=>({results:[]})};return stmt;},exec:()=>{throw Error('write');}};
    expect((await worker.fetch(request('/poem/current'),{DB:db} as any)).status).toBe(404);
    expect(await (await worker.fetch(request('/poem/feed'),{DB:db} as any)).json()).toMatchObject({poems:[]});
    expect((await worker.fetch(request('/poem/admin-delete','POST'),{DB:db} as any)).status).toBe(401);
});
