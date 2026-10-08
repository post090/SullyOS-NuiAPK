import React from 'react';
import { createRoot } from 'react-dom/client';
import DatabaseGuard from '../../components/DatabaseGuard';

// Simulated open failure only; never open or modify the user's actual database.
indexedDB.open = (() => {
  const request = { error: new DOMException('Index with the same ID already exists', 'UnknownError'), onerror: null as null | (() => void) };
  queueMicrotask(() => request.onerror?.());
  return request as unknown as IDBOpenDBRequest;
}) as typeof indexedDB.open;
createRoot(document.getElementById('root')!).render(<DatabaseGuard><p>不应挂载的桌面</p></DatabaseGuard>);
