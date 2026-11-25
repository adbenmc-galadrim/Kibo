export type KeyValueStore = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
};

export type PhoneStorage = { keys: KeyValueStore; snapshots: KeyValueStore };

function memoryStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  return {
    get: async (key) => values.get(key),
    put: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
    keys: async () => [...values.keys()],
    clear: async () => values.clear(),
  };
}

export const memoryStorage = (): PhoneStorage => ({ keys: memoryStore(), snapshots: memoryStore() });
