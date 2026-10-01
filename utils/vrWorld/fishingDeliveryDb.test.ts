import { expect, it, vi } from 'vitest';
import { DB } from '../db';
it('concurrent retry writes exactly one ordinary chat message per delivery key',async()=>{
    const id='delivery-test-'+crypto.randomUUID();const message={charId:id,role:'assistant' as const,type:'text' as const,content:'鱼放回去了。'};
    const ids=await Promise.all([DB.saveMessageOnce('one',message),DB.saveMessageOnce('one',message),DB.saveMessageOnce('two',message)]);
    expect(ids[0]).toBe(ids[1]);expect(ids[2]).not.toBe(ids[0]);
    expect((await DB.getMessagesByCharId(id,true)).map(m=>m.content)).toEqual(['鱼放回去了。','鱼放回去了。']);
});
it('concurrent board posts and unlock retries append without lost updates or duplicate announcements',async()=>{
    const id=crypto.randomUUID();const a={id:id+'a',authorId:'a',authorName:'A',content:'hello',createdAt:1};const b={...a,id:id+'b',authorId:'sar-discovery',authorName:'彼方播报',kind:'collection-unlock' as const,content:'解锁'};
    await Promise.all([DB.appendVRGuestbookMessages([a]),DB.appendVRGuestbookMessages([b]),DB.appendVRGuestbookMessages([b])]);
    expect((await DB.getVRGuestbook())!.messages.filter(m=>m.id.startsWith(id))).toHaveLength(2);
});

it('transaction abort rejects delivery and lets the same event retry later',async()=>{
    const id='aborted-'+crypto.randomUUID();
    const original=IDBObjectStore.prototype.add;
    const mock=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:any[]){
        if(this.name==='messages'){this.transaction.abort();return {onsuccess:null,onerror:null} as any;}
        return original.apply(this,args as any);
    });
    const message={charId:id,role:'assistant' as const,type:'text' as const,content:'hello'};
    try{await expect(DB.saveMessageOnce(id,message)).rejects.toBeTruthy();}finally{mock.mockRestore();}
    expect(await DB.getMessagesByCharId(id,true)).toHaveLength(0);
    await DB.saveMessageOnce(id,message);expect(await DB.getMessagesByCharId(id,true)).toHaveLength(1);
});
