import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocalCursor } from './localRead';
import { DB, openDB } from './db';

afterEach(() => vi.useRealTimers());
describe('readonly loading failures', () => {
  it('rejects an aborted browser transaction', async () => {
    const db = await openDB();
    const actual = db.transaction.bind(db);
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args:any[]) => {
      const tx = actual(...args as [any,any]); queueMicrotask(() => tx.abort()); return tx;
    });
    try { await expect(readLocalCursor(db,'vr_novels')).rejects.toBeTruthy(); }
    finally { spy.mockRestore(); }
  });
  it('bounds an unresponsive reader and only aborts its own transaction', async () => {
    vi.useFakeTimers();
    const tx = { objectStore: () => ({openCursor: () => ({})}), abort:vi.fn() };
    const db = { transaction:()=>tx, addEventListener:vi.fn(), removeEventListener:vi.fn(), close:vi.fn() } as any;
    const result = readLocalCursor(db,'vr_novels',{timeoutMs:50});
    const assertion = expect(result).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(50); await assertion;
    expect(tx.abort).toHaveBeenCalledOnce(); expect(db.close).not.toHaveBeenCalled();
  });
  it('a malformed old book fails visibly without deleting any record', async () => {
    const db = await openDB();
    await new Promise<void>(resolve=>{const tx=db.transaction('vr_novels','readwrite');tx.objectStore('vr_novels').put({id:'broken-old-book',title:'原书'});tx.oncomplete=()=>resolve();});
    await expect(DB.getVRNovelSummaries()).rejects.toThrow('旧书目');
    expect(await DB.getVRNovel('broken-old-book')).toMatchObject({id:'broken-old-book',title:'原书'});
    await new Promise<void>(resolve=>{const tx=db.transaction('vr_novels','readwrite');tx.objectStore('vr_novels').delete('broken-old-book');tx.oncomplete=()=>resolve();});
  });
});

it('settles on transaction abort when the pending request emits nothing', async () => {
  const tx = {objectStore:()=>({openCursor:()=>({})}),abort:vi.fn(),onabort:null as any};
  const db={transaction:()=>tx,addEventListener:vi.fn(),removeEventListener:vi.fn()} as any;
  const result=readLocalCursor(db,'messages');
  tx.onabort();
  await expect(result).rejects.toThrow('中断');
});
it('settles on browser-forced database close', async () => {
  const db=new EventTarget() as any;
  const tx={objectStore:()=>({openCursor:()=>({})}),abort:vi.fn()};
  db.transaction=()=>tx;
  const result=readLocalCursor(db,'messages');
  db.dispatchEvent(new Event('close'));
  await expect(result).rejects.toThrow('连接中断');
  expect(tx.abort).toHaveBeenCalledOnce();
});
