import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { checkDatabaseReadable, subscribeDatabaseFailure } from './databaseHealth';

afterEach(() => vi.restoreAllMocks());

it('checks existing records with readonly transactions and preserves empty/new archives', async () => {
  const factory = new IDBFactory();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('readability-test', 1);
    request.onupgradeneeded = () => {
      for (const name of ['characters', 'messages', 'assets']) request.result.createObjectStore(name, { keyPath: 'id' });
      request.transaction!.objectStore('characters').put({ id: 'kept', name: '旧角色' });
      request.transaction!.objectStore('messages').put({ id: 7, content: '旧聊天' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transactions = vi.spyOn(db, 'transaction');
  try {
    await expect(checkDatabaseReadable(async () => db)).resolves.toBeUndefined();
    expect(transactions.mock.calls.every(call => call[1] === 'readonly')).toBe(true);
    const tx = db.transaction('characters', 'readonly');
    const request = tx.objectStore('characters').get('kept');
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); });
    expect(request.result).toEqual({ id: 'kept', name: '旧角色' });
    const original = db.transaction.bind(db);
    transactions.mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const transaction = original(...args);
      queueMicrotask(() => transaction.abort());
      return transaction;
    });
    await expect(checkDatabaseReadable(async () => db)).rejects.toBeTruthy();
  } finally { db.close(); }
});

it('reports an open failure without deleting or replacing the database, and allows a later retry', async () => {
  const { DB, openDB } = await import('./db');
  await DB.saveCharacter({ id: 'preserved-character', name: '旧角色' } as any);
  const db = await openDB();
  db.onversionchange?.call(db, new Event('versionchange') as IDBVersionChangeEvent);
  const failure = new DOMException('Index with the same ID already exists', 'UnknownError');
  const request = { error: failure, onerror: null as any };
  vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
    queueMicrotask(() => request.onerror());
    return request as any;
  });
  const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase');
  const listener = vi.fn(), unsubscribe = subscribeDatabaseFailure(listener);
  try {
    await expect(openDB()).rejects.toThrow('Index with the same ID already exists');
    expect(listener).toHaveBeenCalledWith({ name: 'UnknownError', message: failure.message });
    expect(deleteSpy).not.toHaveBeenCalled();
    expect((await DB.getAllCharacters()).find(c => c.id === 'preserved-character')?.name).toBe('旧角色');
  } finally { unsubscribe(); const reopened = await openDB(); reopened.close(); }
});
