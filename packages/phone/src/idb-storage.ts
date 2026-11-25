import type { KeyValueStore, PhoneStorage } from "./storage";

const DB_NAME = "kibo-phone";
const DB_VERSION = 1;
const STORES = ["keys", "snapshots"] as const;
type StoreName = (typeof STORES)[number];

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    for (const name of STORES)
      if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
  };
  return done(request);
}

function idbStore(db: Promise<IDBDatabase>, name: StoreName): KeyValueStore {
  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) =>
    done(work((await db).transaction(name, mode).objectStore(name)));
  return {
    get: (key) => run("readonly", (s) => s.get(key)),
    put: async (key, value) => {
      await run("readwrite", (s) => s.put(value, key));
    },
    delete: async (key) => {
      await run("readwrite", (s) => s.delete(key));
    },
    keys: async () => (await run("readonly", (s) => s.getAllKeys())).map(String),
    clear: async () => {
      await run("readwrite", (s) => s.clear());
    },
  };
}

export function indexedDbStorage(): PhoneStorage {
  const db = openDatabase();
  return { keys: idbStore(db, "keys"), snapshots: idbStore(db, "snapshots") };
}
