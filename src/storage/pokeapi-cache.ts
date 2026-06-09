import { openDatabase } from "./indexeddb";

interface CacheRecord {
  key: string;
  data: unknown;
  fetchedAt: number;
  expiresAt: number;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  const record = await new Promise<CacheRecord | undefined>((resolve, reject) => {
    const tx = db.transaction("pokeapiCache", "readonly");
    const request = tx.objectStore("pokeapiCache").get(key);
    request.onsuccess = () => resolve(request.result as CacheRecord | undefined);
    request.onerror = () => reject(request.error);
  });

  if (!record || record.expiresAt < Date.now()) {
    return null;
  }
  return record.data as T;
}

export async function setCachedJson(key: string, data: unknown, ttlMs: number): Promise<void> {
  const db = await openDatabase();
  const now = Date.now();
  const record: CacheRecord = {
    key,
    data,
    fetchedAt: now,
    expiresAt: now + ttlMs,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pokeapiCache", "readwrite");
    const request = tx.objectStore("pokeapiCache").put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
